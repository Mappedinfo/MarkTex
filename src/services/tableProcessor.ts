/**
 * 表格智能处理模块 - 核心特色功能
 * 智能选择 LaTeX 表格环境，自动计算列宽，处理自动换行
 */

import type { TableConfig, TableAnalysis, TableProcessResult } from '../types';
import { getTextWidth } from '../utils/latexEscape';

export class TableProcessor {
  private config: TableConfig;

  constructor(config: TableConfig) {
    this.config = config;
  }

  /**
   * 处理 Markdown 表格，转换为 LaTeX
   */
  processTable(
    rows: string[][],
    alignments: ('left' | 'center' | 'right')[]
  ): TableProcessResult {
    if (!rows || rows.length === 0) {
      return { latexCode: '', environment: 'tabular', packages: [] };
    }

    // 分析表格特征
    const analysis = this.analyzeTable(rows, alignments);

    // 选择合适的表格环境
    const environment = this.selectEnvironment(analysis);

    // 生成列格式字符串
    const columnSpec = this.generateColumnSpec(analysis, environment);

    // 生成表格内容
    const tableContent = this.generateTableContent(rows);

    // 组装完整的 LaTeX 表格代码
    const latexCode = this.assembleTable(environment, columnSpec, tableContent);

    // 确定需要的宏包
    const packages = this.getRequiredPackages(environment);

    return { latexCode, environment, packages, analysis };
  }

  /**
   * 分析表格特征
   */
  private analyzeTable(
    rows: string[][],
    alignments: ('left' | 'center' | 'right')[]
  ): TableAnalysis {
    const numRows = rows.length;
    const numCols = rows[0]?.length || 0;

    // 计算每列的最大内容长度
    const columnMaxLengths: number[] = [];
    for (let col = 0; col < numCols; col++) {
      let maxLength = 0;
      for (let row = 0; row < numRows; row++) {
        const cell = rows[row][col] || '';
        const cellLength = this.getCellDisplayLength(cell);
        maxLength = Math.max(maxLength, cellLength);
      }
      columnMaxLengths.push(maxLength);
    }

    // 检测是否有长文本单元格
    const hasLongText = columnMaxLengths.some(
      (len) => len >= this.config.autoWrapThreshold
    );

    // 识别长文本列的索引
    const longTextColumns = columnMaxLengths
      .map((len, idx) => (len >= this.config.autoWrapThreshold ? idx : -1))
      .filter((idx) => idx !== -1);

    return {
      numRows,
      numCols,
      columnMaxLengths,
      hasLongText,
      longTextColumns,
      alignments: alignments.length > 0 ? alignments : Array(numCols).fill('left'),
      totalContentLength: columnMaxLengths.reduce((sum, len) => sum + len, 0),
    };
  }

  /**
   * 计算单元格显示长度
   */
  private getCellDisplayLength(text: string): number {
    if (!text) return 0;

    // 移除 Markdown 格式标记
    const cleaned = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    return getTextWidth(cleaned);
  }

  /**
   * 选择最优的表格环境
   */
  private selectEnvironment(analysis: TableAnalysis): 'tabular' | 'tabularx' | 'longtable' {
    const { numRows, numCols, hasLongText } = analysis;

    // 决策树
    if (numRows > 30) {
      return 'longtable';
    }

    if (!hasLongText) {
      return 'tabular';
    }

    if (numCols <= 5) {
      return 'tabularx';
    }

    return 'tabular';
  }

  /**
   * 生成列格式字符串
   */
  private generateColumnSpec(
    analysis: TableAnalysis,
    environment: 'tabular' | 'tabularx' | 'longtable'
  ): string {
    const { numCols, columnMaxLengths, alignments, longTextColumns } = analysis;

    if (environment === 'tabularx') {
      return this.generateTabularxSpec(numCols, alignments, longTextColumns);
    } else {
      return this.generateTabularSpec(numCols, columnMaxLengths, alignments, longTextColumns);
    }
  }

  /**
   * 生成 tabularx 列格式
   */
  private generateTabularxSpec(
    numCols: number,
    alignments: ('left' | 'center' | 'right')[],
    longTextColumns: number[]
  ): string {
    const specs: string[] = [];

    for (let i = 0; i < numCols; i++) {
      const isLong = longTextColumns.includes(i);
      const align = alignments[i] || 'left';

      if (isLong) {
        specs.push('X');
      } else {
        specs.push(this.getAlignmentChar(align));
      }
    }

    return specs.join(' ');
  }

  /**
   * 生成 tabular 列格式
   */
  private generateTabularSpec(
    numCols: number,
    columnMaxLengths: number[],
    alignments: ('left' | 'center' | 'right')[],
    longTextColumns: number[]
  ): string {
    const specs: string[] = [];
    const widths = this.calculateColumnWidths(columnMaxLengths, longTextColumns);

    for (let i = 0; i < numCols; i++) {
      const isLong = longTextColumns.includes(i);
      const align = alignments[i] || 'left';

      if (isLong && widths[i] > 0) {
        const widthType = this.getWidthType(align);
        specs.push(`${widthType}{${widths[i]}\\textwidth}`);
      } else {
        specs.push(this.getAlignmentChar(align));
      }
    }

    return specs.join(' ');
  }

  /**
   * 计算列宽分配（智能算法）
   */
  private calculateColumnWidths(columnMaxLengths: number[], longTextColumns: number[]): number[] {
    const widths = Array(columnMaxLengths.length).fill(0);

    if (longTextColumns.length === 0) {
      return widths;
    }

    // 计算长文本列的总长度
    const longTextLengths = longTextColumns.map((idx) => columnMaxLengths[idx]);
    const totalLongTextLength = longTextLengths.reduce((sum, len) => sum + len, 0);

    // 预留边距和列间距
    const numCols = columnMaxLengths.length;
    const availableWidth = 1.0 - 0.05 - (numCols - 1) * 0.02;

    // 按内容长度比例分配宽度
    longTextColumns.forEach((colIdx, i) => {
      const ratio = longTextLengths[i] / totalLongTextLength;
      let width = availableWidth * ratio;

      // 应用约束
      width = Math.max(width, 0.1);
      width = Math.min(width, 0.8);

      widths[colIdx] = parseFloat(width.toFixed(2));
    });

    // 如果分配的总宽度超过可用宽度，按比例缩减
    const allocatedWidth = widths.reduce((sum, w) => sum + w, 0);
    if (allocatedWidth > availableWidth) {
      const scaleFactor = availableWidth / allocatedWidth;
      widths.forEach((w, i) => {
        if (w > 0) widths[i] = parseFloat((w * scaleFactor).toFixed(2));
      });
    }

    return widths;
  }

  /**
   * 获取对齐字符
   */
  private getAlignmentChar(alignment: 'left' | 'center' | 'right'): string {
    const map = {
      left: 'l',
      center: 'c',
      right: 'r',
    };
    return map[alignment] || 'l';
  }

  /**
   * 获取宽度类型
   */
  private getWidthType(alignment: 'left' | 'center' | 'right'): string {
    const map = {
      left: 'p',
      center: 'm',
      right: 'b',
    };
    return map[alignment] || 'p';
  }

  /**
   * 生成表格内容
   */
  private generateTableContent(rows: string[][]): string[] {
    return rows.map((row) => row.map((cell) => cell.trim()).join(' & '));
  }

  /**
   * 组装完整的表格 LaTeX 代码
   */
  private assembleTable(
    environment: 'tabular' | 'tabularx' | 'longtable',
    columnSpec: string,
    content: string[]
  ): string {
    const lines: string[] = [];
    const useBootabs = this.config.tableStyle === 'booktabs';

    // 开始环境
    if (environment === 'tabularx') {
      lines.push(`\\begin{tabularx}{\\textwidth}{${columnSpec}}`);
    } else if (environment === 'longtable') {
      lines.push(`\\begin{longtable}{${columnSpec}}`);
    } else {
      lines.push(`\\begin{tabular}{${columnSpec}}`);
    }

    // 顶部线
    lines.push(useBootabs ? '\\toprule' : '\\hline');

    // 表头
    if (content.length > 0) {
      lines.push(content[0] + ' \\\\');
      lines.push(useBootabs ? '\\midrule' : '\\hline');
    }

    // 表格主体
    for (let i = 1; i < content.length; i++) {
      lines.push(content[i] + ' \\\\');
    }

    // 底部线
    lines.push(useBootabs ? '\\bottomrule' : '\\hline');

    // 结束环境
    lines.push(`\\end{${environment}}`);

    return lines.join('\n');
  }

  /**
   * 获取所需宏包
   */
  private getRequiredPackages(environment: 'tabular' | 'tabularx' | 'longtable'): string[] {
    const packages: string[] = [];

    if (this.config.tableStyle === 'booktabs') {
      packages.push('booktabs');
    }

    if (environment === 'tabularx') {
      packages.push('tabularx');
    } else if (environment === 'longtable') {
      packages.push('longtable');
    }

    return packages;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<TableConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
