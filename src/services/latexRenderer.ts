/**
 * LaTeX 渲染器 - 将 Markdown AST 转换为 LaTeX
 */

import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import type { LatexRenderResult, TableConfig } from '../types';
import { escapeLaTeX, hasChinese } from '../utils/latexEscape';
import { TableProcessor } from './tableProcessor';

export class LatexRenderer {
  private md: MarkdownIt;
  private tableProcessor: TableProcessor;
  private packages: Set<string>;
  private flags: {
    hasChinese: boolean;
    hasImages: boolean;
    hasTables: boolean;
    hasCode: boolean;
    hasMath: boolean;
  };

  constructor(tableConfig: TableConfig) {
    // 初始化 markdown-it
    this.md = new MarkdownIt({
      html: false,
      breaks: true,
      linkify: true,
    });

    this.tableProcessor = new TableProcessor(tableConfig);
    this.packages = new Set();
    this.flags = {
      hasChinese: false,
      hasImages: false,
      hasTables: false,
      hasCode: false,
      hasMath: false,
    };
  }

  /**
   * 渲染 Markdown 为 LaTeX
   */
  render(markdown: string): LatexRenderResult {
    // 重置状态
    this.packages.clear();
    this.flags = {
      hasChinese: false,
      hasImages: false,
      hasTables: false,
      hasCode: false,
      hasMath: false,
    };

    // 检测中文
    if (hasChinese(markdown)) {
      this.flags.hasChinese = true;
    }

    // 解析 Markdown
    const tokens = this.md.parse(markdown, {});

    // 渲染 tokens
    const content = this.renderTokens(tokens);

    return {
      content,
      packages: this.packages,
      ...this.flags,
    };
  }

  /**
   * 渲染 tokens 数组
   */
  private renderTokens(tokens: Token[]): string {
    const result: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];
      const rendered = this.renderToken(token, tokens, i);
      if (rendered) {
        result.push(rendered);
      }
      i++;
    }

    return result.join('\n\n');
  }

  /**
   * 渲染单个 token
   */
  private renderToken(token: Token, tokens: Token[], index: number): string {
    switch (token.type) {
      case 'heading_open':
        return this.renderHeading(tokens, index);
      case 'paragraph_open':
        return this.renderParagraph(tokens, index);
      case 'bullet_list_open':
      case 'ordered_list_open':
        return this.renderList(tokens, index);
      case 'blockquote_open':
        return this.renderBlockquote(tokens, index);
      case 'fence':
      case 'code_block':
        return this.renderCodeBlock(token);
      case 'table_open':
        return this.renderTable(tokens, index);
      case 'hr':
        return '\\hrule';
      default:
        return '';
    }
  }

  /**
   * 渲染标题
   */
  private renderHeading(tokens: Token[], index: number): string {
    const openToken = tokens[index];
    const contentToken = tokens[index + 1];
    const level = parseInt(openToken.tag.substring(1));

    const commands = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
    const command = commands[Math.min(level - 1, commands.length - 1)];

    const content = this.renderInline(contentToken);
    return `\\${command}{${content}}`;
  }

  /**
   * 渲染段落
   */
  private renderParagraph(tokens: Token[], index: number): string {
    const contentToken = tokens[index + 1];
    return this.renderInline(contentToken);
  }

  /**
   * 渲染行内内容
   */
  private renderInline(token: Token): string {
    if (!token || !token.children) return '';

    const result: string[] = [];

    for (const child of token.children) {
      switch (child.type) {
        case 'text':
          result.push(escapeLaTeX(child.content, true));
          break;
        case 'strong_open':
          break;
        case 'strong_close':
          break;
        case 'em_open':
          break;
        case 'em_close':
          break;
        case 'code_inline':
          result.push(`\\texttt{${escapeLaTeX(child.content)}}`);
          break;
        case 'link_open':
          break;
        case 'link_close':
          break;
        case 'image':
          this.flags.hasImages = true;
          this.packages.add('graphicx');
          const alt = child.content || '';
          const src = child.attrGet('src') || '';
          result.push(`\\includegraphics{${src}}`);
          break;
        case 's_open':
          break;
        case 's_close':
          break;
        default:
          if (child.content) {
            result.push(escapeLaTeX(child.content, true));
          }
      }
    }

    // 处理格式化标记
    let output = result.join('');

    // 简单的格式化处理（需要改进）
    output = this.processInlineFormatting(token, output);

    return output;
  }

  /**
   * 处理行内格式化
   */
  private processInlineFormatting(token: Token, content: string): string {
    if (!token.children) return content;

    let result = content;
    let offset = 0;

    for (let i = 0; i < token.children.length; i++) {
      const child = token.children[i];

      if (child.type === 'strong_open' && i + 2 < token.children.length) {
        const textToken = token.children[i + 1];
        if (textToken.type === 'text') {
          const text = escapeLaTeX(textToken.content, true);
          const boldText = `\\textbf{${text}}`;
          result = result.replace(text, boldText);
        }
        i += 2;
      } else if (child.type === 'em_open' && i + 2 < token.children.length) {
        const textToken = token.children[i + 1];
        if (textToken.type === 'text') {
          const text = escapeLaTeX(textToken.content, true);
          const italicText = `\\textit{${text}}`;
          result = result.replace(text, italicText);
        }
        i += 2;
      } else if (child.type === 's_open' && i + 2 < token.children.length) {
        this.packages.add('ulem');
        const textToken = token.children[i + 1];
        if (textToken.type === 'text') {
          const text = escapeLaTeX(textToken.content, true);
          const strikeText = `\\sout{${text}}`;
          result = result.replace(text, strikeText);
        }
        i += 2;
      } else if (child.type === 'link_open' && i + 2 < token.children.length) {
        this.packages.add('hyperref');
        const textToken = token.children[i + 1];
        const url = child.attrGet('href') || '';
        if (textToken.type === 'text') {
          const text = textToken.content;
          const linkText = `\\href{${url}}{${escapeLaTeX(text)}}`;
          result = result.replace(escapeLaTeX(text, true), linkText);
        }
        i += 2;
      }
    }

    return result;
  }

  /**
   * 渲染列表
   */
  private renderList(tokens: Token[], startIndex: number): string {
    const openToken = tokens[startIndex];
    const isOrdered = openToken.type === 'ordered_list_open';
    const environment = isOrdered ? 'enumerate' : 'itemize';

    const lines: string[] = [`\\begin{${environment}}`];

    let i = startIndex + 1;
    while (i < tokens.length && tokens[i].type !== (isOrdered ? 'ordered_list_close' : 'bullet_list_close')) {
      if (tokens[i].type === 'list_item_open') {
        const itemContent = this.renderListItem(tokens, i);
        lines.push(`\\item ${itemContent}`);
      }
      i++;
    }

    lines.push(`\\end{${environment}}`);
    return lines.join('\n');
  }

  /**
   * 渲染列表项
   */
  private renderListItem(tokens: Token[], startIndex: number): string {
    let i = startIndex + 1;
    const content: string[] = [];

    while (i < tokens.length && tokens[i].type !== 'list_item_close') {
      if (tokens[i].type === 'paragraph_open') {
        const para = this.renderParagraph(tokens, i);
        content.push(para);
        i += 2; // skip paragraph_open, inline, paragraph_close
      } else if (tokens[i].type === 'bullet_list_open' || tokens[i].type === 'ordered_list_open') {
        const nestedList = this.renderList(tokens, i);
        content.push(nestedList);
        // Skip to list close
        let depth = 1;
        i++;
        while (i < tokens.length && depth > 0) {
          if (tokens[i].type.includes('list_open')) depth++;
          if (tokens[i].type.includes('list_close')) depth--;
          i++;
        }
        continue;
      }
      i++;
    }

    return content.join(' ');
  }

  /**
   * 渲染引用块
   */
  private renderBlockquote(tokens: Token[], startIndex: number): string {
    const lines: string[] = ['\\begin{quote}'];

    let i = startIndex + 1;
    while (i < tokens.length && tokens[i].type !== 'blockquote_close') {
      const rendered = this.renderToken(tokens[i], tokens, i);
      if (rendered) {
        lines.push(rendered);
      }
      i++;
    }

    lines.push('\\end{quote}');
    return lines.join('\n');
  }

  /**
   * 渲染代码块
   */
  private renderCodeBlock(token: Token): string {
    this.flags.hasCode = true;
    this.packages.add('listings');
    this.packages.add('xcolor');

    const lang = token.info || '';
    const code = token.content;

    if (lang) {
      return `\\begin{lstlisting}[language=${lang}]\n${code}\\end{lstlisting}`;
    } else {
      return `\\begin{lstlisting}\n${code}\\end{lstlisting}`;
    }
  }

  /**
   * 渲染表格
   */
  private renderTable(tokens: Token[], startIndex: number): string {
    this.flags.hasTables = true;

    // 提取表格数据
    const tableData = this.extractTableData(tokens, startIndex);
    
    // 使用表格处理器
    const result = this.tableProcessor.processTable(tableData.rows, tableData.alignments);

    // 添加所需宏包
    result.packages.forEach((pkg) => this.packages.add(pkg));

    return result.latexCode;
  }

  /**
   * 提取表格数据
   */
  private extractTableData(tokens: Token[], startIndex: number): {
    rows: string[][];
    alignments: ('left' | 'center' | 'right')[];
  } {
    const rows: string[][] = [];
    const alignments: ('left' | 'center' | 'right')[] = [];

    let i = startIndex + 1;
    let currentRow: string[] = [];
    let isHeader = true;

    while (i < tokens.length && tokens[i].type !== 'table_close') {
      const token = tokens[i];

      if (token.type === 'thead_open' || token.type === 'tbody_open') {
        i++;
        continue;
      }

      if (token.type === 'thead_close' || token.type === 'tbody_close') {
        i++;
        isHeader = false;
        continue;
      }

      if (token.type === 'tr_open') {
        currentRow = [];
        i++;
        continue;
      }

      if (token.type === 'tr_close') {
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
        }
        i++;
        continue;
      }

      if (token.type === 'th_open' || token.type === 'td_open') {
        // 提取对齐方式
        const style = token.attrGet('style') || '';
        if (isHeader && token.type === 'th_open') {
          if (style.includes('text-align:center')) {
            alignments.push('center');
          } else if (style.includes('text-align:right')) {
            alignments.push('right');
          } else {
            alignments.push('left');
          }
        }

        // 提取单元格内容
        const inlineToken = tokens[i + 1];
        const cellContent = this.renderInline(inlineToken);
        currentRow.push(cellContent);
        i += 2; // skip th/td_close
        continue;
      }

      i++;
    }

    return { rows, alignments };
  }

  /**
   * 更新表格配置
   */
  updateTableConfig(config: Partial<TableConfig>): void {
    this.tableProcessor.updateConfig(config);
  }
}
