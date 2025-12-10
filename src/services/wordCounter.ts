/**
 * 字数统计服务
 * 支持智能表格过滤，分别统计正文、表格和全部单词数
 */

export interface WordCountResult {
  totalWords: number;      // 全部单词数
  bodyWords: number;        // 正文单词数（不含表格）
  tableWords: number;       // 表格单词数
  totalChars: number;       // 总字符数
  bodyChars: number;        // 正文字符数
  tableChars: number;       // 表格字符数
}

/**
 * 统计文本中的单词数
 * 支持中英文混合计数
 */
function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  // 移除多余空格
  text = text.trim();
  
  // 分离中文字符和英文单词
  let wordCount = 0;
  
  // 统计中文字符（每个中文字符算一个词）
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  if (chineseChars) {
    wordCount += chineseChars.length;
  }
  
  // 移除中文字符后统计英文单词
  const textWithoutChinese = text.replace(/[\u4e00-\u9fa5]/g, ' ');
  
  // 统计英文单词（连续的字母、数字组合）
  const englishWords = textWithoutChinese.match(/[a-zA-Z0-9]+/g);
  if (englishWords) {
    wordCount += englishWords.length;
  }
  
  return wordCount;
}

/**
 * 统计字符数（不含空格）
 */
function countChars(text: string): number {
  if (!text) return 0;
  // 移除所有空白字符后统计
  return text.replace(/\s+/g, '').length;
}

/**
 * 从 Markdown 中提取表格内容
 */
function extractTables(markdown: string): string[] {
  const tables: string[] = [];
  const lines = markdown.split('\n');
  
  let inTable = false;
  let currentTable: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 检测表格行（以 | 开头或包含 |）
    const isTableLine = trimmedLine.startsWith('|') || 
                        (trimmedLine.includes('|') && trimmedLine.split('|').length >= 3);
    
    if (isTableLine) {
      if (!inTable) {
        inTable = true;
        currentTable = [];
      }
      currentTable.push(line);
    } else {
      // 如果之前在表格中，现在结束了
      if (inTable && currentTable.length > 0) {
        tables.push(currentTable.join('\n'));
        currentTable = [];
      }
      inTable = false;
    }
  }
  
  // 处理最后一个表格
  if (currentTable.length > 0) {
    tables.push(currentTable.join('\n'));
  }
  
  return tables;
}

/**
 * 从表格 Markdown 中提取纯文本内容
 */
function extractTableText(tableMarkdown: string): string {
  const lines = tableMarkdown.split('\n');
  const textParts: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // 跳过分隔行（如 |---|---|）
    if (/^\|[\s\-:|]+\|$/.test(trimmedLine)) {
      continue;
    }
    
    // 提取单元格内容
    const cells = trimmedLine
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);
    
    textParts.push(...cells);
  }
  
  return textParts.join(' ');
}

/**
 * 移除 Markdown 格式标记，保留纯文本
 */
function stripMarkdownFormatting(text: string): string {
  let result = text;
  
  // 移除代码块
  result = result.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/`[^`]+`/g, '');
  
  // 移除标题标记
  result = result.replace(/^#{1,6}\s+/gm, '');
  
  // 移除粗体和斜体标记
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/\*([^*]+)\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  result = result.replace(/_([^_]+)_/g, '$1');
  
  // 移除链接，保留文本
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // 移除图片
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  
  // 移除行内公式和块级公式
  result = result.replace(/\$\$[\s\S]*?\$\$/g, '');
  result = result.replace(/\$[^$]+\$/g, '');
  
  // 移除列表标记
  result = result.replace(/^[\s]*[-*+]\s+/gm, '');
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');
  
  // 移除引用标记
  result = result.replace(/^>\s+/gm, '');
  
  // 移除水平线
  result = result.replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '');
  
  return result;
}

/**
 * 统计 Markdown 内容的字数
 * 自动区分正文和表格
 */
export function countMarkdownWords(markdown: string): WordCountResult {
  if (!markdown || markdown.trim().length === 0) {
    return {
      totalWords: 0,
      bodyWords: 0,
      tableWords: 0,
      totalChars: 0,
      bodyChars: 0,
      tableChars: 0,
    };
  }
  
  // 提取所有表格
  const tables = extractTables(markdown);
  
  // 创建不含表格的正文
  let bodyMarkdown = markdown;
  for (const table of tables) {
    bodyMarkdown = bodyMarkdown.replace(table, '');
  }
  
  // 移除 Markdown 格式标记
  const bodyText = stripMarkdownFormatting(bodyMarkdown);
  
  // 提取表格中的文本
  const tableTexts = tables.map(extractTableText);
  const tableText = tableTexts.join(' ');
  
  // 统计正文
  const bodyWords = countWords(bodyText);
  const bodyChars = countChars(bodyText);
  
  // 统计表格
  const tableWords = countWords(tableText);
  const tableChars = countChars(tableText);
  
  // 统计总计
  const totalWords = bodyWords + tableWords;
  const totalChars = bodyChars + tableChars;
  
  return {
    totalWords,
    bodyWords,
    tableWords,
    totalChars,
    bodyChars,
    tableChars,
  };
}
