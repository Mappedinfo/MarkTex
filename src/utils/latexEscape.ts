/**
 * LaTeX 特殊字符转义工具
 */

// LaTeX 特殊字符映射表
const LATEX_SPECIAL_CHARS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

/**
 * 转义 LaTeX 特殊字符
 */
export function escapeLaTeX(text: string, preserveMath = false): string {
  if (!text) return '';

  // 如果需要保留数学公式
  if (preserveMath) {
    const mathParts: string[] = [];
    // 使用更安全的占位符,避免被转义
    let result = text.replace(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g, (match) => {
      mathParts.push(match);
      return `§§MATH${mathParts.length - 1}§§`;
    });

    // 转义非数学部分
    result = escapeText(result);

    // 恢复数学公式
    mathParts.forEach((math, index) => {
      result = result.replace(`§§MATH${index}§§`, math);
    });

    return result;
  }

  return escapeText(text);
}

/**
 * 转义普通文本
 */
function escapeText(text: string): string {
  // 先处理反斜杠
  let result = text.replace(/\\/g, LATEX_SPECIAL_CHARS['\\']);

  // 处理其他特殊字符
  for (const [char, escaped] of Object.entries(LATEX_SPECIAL_CHARS)) {
    if (char !== '\\') {
      result = result.replace(new RegExp('\\' + char, 'g'), escaped);
    }
  }

  return result;
}

/**
 * 检测文本中是否包含中文字符
 */
export function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 计算文本的显示宽度（考虑中英文字符差异）
 */
export function getTextWidth(text: string): number {
  if (!text) return 0;

  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // 中文字符按 2 个单位计算
    if (/[\u4e00-\u9fa5]/.test(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * 清理和标准化文本
 */
export function cleanText(text: string): string {
  if (!text) return '';

  return text
    .replace(/\r\n/g, '\n') // 统一换行符
    .replace(/\t/g, '    ') // 制表符转空格
    .trim();
}
