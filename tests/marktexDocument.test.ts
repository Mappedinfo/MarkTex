import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLatexDocument } from '../src/headless/marktexDocument.ts';
import type { AppConfig } from '../src/types/index.ts';

test('generateLatexDocument keeps existing Markdown to LaTeX rendering', () => {
  const result = generateLatexDocument('# Title\n\nA table:\n\n| A | B |\n|---|---|\n| 1 | 2 |', {
    config: configFixture(),
    enableBiblatexApa: true
  });

  assert.match(result.tex, /\\section\{Title\}/);
  assert.match(result.tex, /\\begin\{tabular\}/);
});

test('generateLatexDocument converts single and grouped Pandoc citations to parencite', () => {
  const result = generateLatexDocument('Claim [@smith2024; @chen2023]. Other [@wang-2025].', {
    config: configFixture(),
    bibliographyFiles: ['references.bib']
  });

  assert.match(result.tex, /\\parencite\{smith2024,chen2023\}/);
  assert.match(result.tex, /\\parencite\{wang-2025\}/);
  assert.deepEqual(result.citekeys, ['smith2024', 'chen2023', 'wang-2025']);
});

test('generateLatexDocument injects biblatex APA resources and bibliography', () => {
  const result = generateLatexDocument('Claim [@smith2024].', {
    config: configFixture(),
    bibliographyFiles: ['references.bib']
  });

  assert.match(result.tex, /\\usepackage\[style=apa,backend=biber\]\{biblatex\}/);
  assert.match(result.tex, /\\addbibresource\{references\.bib\}/);
  assert.match(result.tex, /\\printbibliography/);
  assert.equal(result.diagnostics.length, 0);
});

test('generateLatexDocument reports missing bibliography without swallowing citekeys', () => {
  const result = generateLatexDocument('Claim [@smith2024].', {
    config: configFixture()
  });

  assert.match(result.tex, /\\parencite\{smith2024\}/);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.code).join(','), /missing-bibliography/);
});

test('generateLatexDocument can use local TeX Live Fandol fonts for CJK output', () => {
  const result = generateLatexDocument('中文测试', {
    config: configFixture({ enableChinese: true }),
    cjkFontPath: '/usr/local/texlive/2025basic/texmf-dist/fonts/opentype/public/fandol'
  });

  assert.doesNotMatch(result.tex, /Noto Sans CJK SC/);
  assert.match(result.tex, /FandolSong-Regular/);
  assert.match(result.tex, /Path=\{\/usr\/local\/texlive\/2025basic\/texmf-dist\/fonts\/opentype\/public\/fandol\/\}/);
});

test('generateLatexDocument renders Obsidian wikilinks as display text before table conversion', () => {
  const result = generateLatexDocument('| Paper | Status |\n|---|---|\n| [[Clippings/example.md|Readable Paper]] | ok |', {
    config: configFixture()
  });

  assert.match(result.tex, /Readable Paper/);
  assert.doesNotMatch(result.tex, /\[\[Clippings/);
  assert.doesNotMatch(result.tex, /example\.md\|Readable Paper/);
});

test('generateLatexDocument downgrades unsupported code fence languages for listings', () => {
  const result = generateLatexDocument('```mermaid\nflowchart TD\n  A --> B\n```', {
    config: configFixture()
  });

  assert.match(result.tex, /\\begin\{lstlisting\}\nflowchart TD/);
  assert.doesNotMatch(result.tex, /language=mermaid/);
});

function configFixture(overrides: Partial<AppConfig['document']> = {}): AppConfig {
  return {
    document: {
      documentClass: 'article',
      fontSize: '11pt',
      pageSize: 'a4paper',
      enableChinese: false,
      enableTOC: false,
      ...overrides
    },
    table: {
      tableStyle: 'booktabs',
      autoWrapThreshold: 20
    }
  };
}
