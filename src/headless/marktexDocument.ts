import { DocumentGenerator } from '../services/documentGenerator';
import { LatexRenderer } from '../services/latexRenderer';
import type { AppConfig } from '../types';

export type MarkTexDiagnosticLevel = 'info' | 'warning' | 'error';

export interface MarkTexDiagnostic {
  level: MarkTexDiagnosticLevel;
  code: string;
  message: string;
}

export interface MarkTexDocumentOptions {
  config: AppConfig;
  bibliographyFiles?: string[];
  enableBiblatexApa?: boolean;
  cjkFontPath?: string | null;
}

export interface MarkTexDocumentResult {
  tex: string;
  diagnostics: MarkTexDiagnostic[];
  citekeys: string[];
}

interface CitationPreprocessResult {
  markdown: string;
  replacements: Map<string, string>;
  citekeys: string[];
}

export function generateLatexDocument(markdown: string, options: MarkTexDocumentOptions): MarkTexDocumentResult {
  const normalizedMarkdown = preprocessObsidianWikilinks(markdown);
  const citationState = preprocessPandocCitations(normalizedMarkdown);
  const renderer = new LatexRenderer(options.config.table);
  const documentGenerator = new DocumentGenerator();
  const renderResult = renderer.render(citationState.markdown);
  renderResult.content = restoreCitationPlaceholders(renderResult.content, citationState.replacements);

  let tex = documentGenerator.generate(renderResult, options.config.document, true);
  if (options.cjkFontPath) {
    tex = injectLocalCjkFonts(tex, options.cjkFontPath);
  }
  const diagnostics: MarkTexDiagnostic[] = [];
  const bibliographyFiles = uniqueStrings(options.bibliographyFiles ?? []);
  const hasCitations = citationState.citekeys.length > 0;

  if (options.enableBiblatexApa !== false && hasCitations) {
    tex = injectBiblatexApa(tex, bibliographyFiles);
    if (bibliographyFiles.length === 0) {
      diagnostics.push({
        level: 'warning',
        code: 'missing-bibliography',
        message: `Found citations (${citationState.citekeys.join(', ')}) but no .bib file was resolved.`
      });
    }
  }

  return {
    tex,
    diagnostics,
    citekeys: citationState.citekeys
  };
}

export function preprocessPandocCitations(markdown: string): CitationPreprocessResult {
  const replacements = new Map<string, string>();
  const citekeys: string[] = [];
  let counter = 0;
  let inFence = false;

  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const processed = lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    return replaceCitationsOutsideInlineCode(line, (raw) => {
      const keys = parsePandocCitekeys(raw);
      if (keys.length === 0) return raw;
      for (const key of keys) citekeys.push(key);
      const placeholder = `§§MARKTEXCITE${counter}§§`;
      counter += 1;
      replacements.set(placeholder, `\\parencite{${keys.join(',')}}`);
      return placeholder;
    });
  });

  return {
    markdown: processed.join('\n'),
    replacements,
    citekeys: uniqueStrings(citekeys)
  };
}

export function preprocessObsidianWikilinks(markdown: string): string {
  let inFence = false;
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      return replaceOutsideInlineCode(line, (part) =>
        part.replace(/(^|[^!])\[\[([^\]]+)\]\]/g, (_raw, prefix: string, target: string) => `${prefix}${wikilinkLabel(target)}`)
      );
    })
    .join('\n');
}

export function parsePandocCitekeys(markup: string): string[] {
  const content = markup.replace(/^\[/, '').replace(/\]$/, '');
  const keys: string[] = [];
  const citationPattern = /@([A-Za-z0-9][A-Za-z0-9_:.#$%&+?~\/-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = citationPattern.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return uniqueStrings(keys);
}

function replaceCitationsOutsideInlineCode(line: string, replacer: (raw: string) => string): string {
  return replaceOutsideInlineCode(line, (part) => part.replace(/\[((?:[^\[\]]*@[\s\S]*?))\]/g, (raw) => replacer(raw)));
}

function replaceOutsideInlineCode(line: string, replacer: (part: string) => string): string {
  const parts = line.split(/(`+[^`]*`+)/g);
  return parts
    .map((part) => {
      if (/^`/.test(part)) return part;
      return replacer(part);
    })
    .join('');
}

function wikilinkLabel(target: string): string {
  const [pathPart, aliasPart] = target.split('|');
  const alias = aliasPart?.trim();
  if (alias) return alias;
  const pathWithoutAnchor = pathPart.trim().split('#')[0];
  const name = pathWithoutAnchor.slice(pathWithoutAnchor.lastIndexOf('/') + 1);
  return name.replace(/\.[^.]+$/, '') || pathPart.trim();
}

function restoreCitationPlaceholders(content: string, replacements: Map<string, string>): string {
  let restored = content;
  for (const [placeholder, latex] of replacements) {
    restored = restored.split(placeholder).join(latex);
  }
  return restored;
}

function injectBiblatexApa(tex: string, bibliographyFiles: string[]): string {
  const packageLines = [
    '\\usepackage[style=apa,backend=biber]{biblatex}',
    ...bibliographyFiles.map((file) => `\\addbibresource{${escapeLatexPath(file)}}`)
  ];
  let next = tex.replace('\\begin{document}', `${packageLines.join('\n')}\n\n\\begin{document}`);
  if (bibliographyFiles.length > 0 && !/\\printbibliography\b/.test(next)) {
    next = next.replace('\\end{document}', '\\printbibliography\n\n\\end{document}');
  }
  return next;
}

function injectLocalCjkFonts(tex: string, fontPath: string): string {
  const normalizedPath = fontPath.replace(/\\/g, '/').replace(/\/?$/, '/');
  return tex
    .replace('% 使用 Overleaf 系统字体,如果编译失败请改为其他中文字体', '% 使用 TeX Live Fandol 字体进行本机 XeLaTeX 编译')
    .replace('% 可选字体: Noto Sans CJK SC, Source Han Sans SC, SimSun, FandolSong', '% 字体路径由 MarkTex 自动探测')
    .replace(
      '\\setCJKmainfont{Noto Sans CJK SC}',
      `\\setCJKmainfont[Path={${normalizedPath}},Extension=.otf,UprightFont=FandolSong-Regular,BoldFont=FandolSong-Bold,ItalicFont=FandolKai-Regular]{FandolSong}`
    )
    .replace(
      '\\setCJKsansfont{Noto Sans CJK SC}',
      `\\setCJKsansfont[Path={${normalizedPath}},Extension=.otf,UprightFont=FandolHei-Regular,BoldFont=FandolHei-Regular]{FandolHei}`
    )
    .replace(
      '\\setCJKmonofont{Noto Sans CJK SC}',
      `\\setCJKmonofont[Path={${normalizedPath}},Extension=.otf,UprightFont=FandolFang-Regular]{FandolFang}`
    );
}

function escapeLatexPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/%/g, '\\%');
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
