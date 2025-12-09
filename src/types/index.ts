/**
 * 应用类型定义
 */

// 文档配置
export interface DocumentConfig {
  documentClass: 'article' | 'report' | 'book';
  fontSize: '10pt' | '11pt' | '12pt';
  pageSize: 'a4paper' | 'letterpaper' | 'a5paper';
  enableChinese: boolean;
  enableTOC: boolean;
}

// 表格配置
export interface TableConfig {
  tableStyle: 'booktabs' | 'standard';
  autoWrapThreshold: number;
}

// 应用配置
export interface AppConfig {
  document: DocumentConfig;
  table: TableConfig;
}

// 表格分析结果
export interface TableAnalysis {
  numRows: number;
  numCols: number;
  columnMaxLengths: number[];
  hasLongText: boolean;
  longTextColumns: number[];
  alignments: ('left' | 'center' | 'right')[];
  totalContentLength: number;
}

// 表格处理结果
export interface TableProcessResult {
  latexCode: string;
  environment: 'tabular' | 'tabularx' | 'longtable';
  packages: string[];
  analysis?: TableAnalysis;
}

// LaTeX 渲染结果
export interface LatexRenderResult {
  content: string;
  packages: Set<string>;
  hasChinese: boolean;
  hasImages: boolean;
  hasTables: boolean;
  hasCode: boolean;
  hasMath: boolean;
}
