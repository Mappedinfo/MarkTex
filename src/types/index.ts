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

// 引擎状态
export type EngineStatus = 'unloaded' | 'loading' | 'ready' | 'error';

// 编译阶段
export type CompilationStage = 
  | 'idle'
  | 'engine-loading'
  | 'font-loading'
  | 'file-preparing'
  | 'compiling'
  | 'generating-pdf'
  | 'complete'
  | 'error';

// 字体加载状态
export interface FontStatus {
  [fontName: string]: 'pending' | 'loading' | 'loaded' | 'error';
}

// 编译配置
export interface CompileConfig {
  engineCommand: 'xelatex' | 'pdflatex';
  maxCompileTime: number; // 毫秒
  enableCache: boolean;
  passes: number; // 编译次数
}

// 编译结果
export interface CompileResult {
  success: boolean;
  pdf?: Uint8Array;
  log?: string;
  error?: string;
}

// 编译进度信息
export interface CompilationProgress {
  stage: CompilationStage;
  progress: number; // 0-100
  message: string;
}
