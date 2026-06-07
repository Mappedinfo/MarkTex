/**
 * 导出服务
 * 支持 LaTeX 源码下载和复制到剪贴板
 */

export class ExportService {
  /**
   * 下载 LaTeX 文件
   */
  downloadLatex(content: string, filename = 'document.tex'): void {
    const activeDoc = getActiveDocument();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = activeDoc.createElement('a');
    link.href = url;
    link.download = filename;
    activeDoc.body.appendChild(link);
    link.click();
    activeDoc.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(content: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        return true;
      } else {
        // 降级方案
        const activeDoc = getActiveDocument();
        const textarea = activeDoc.createElement('textarea');
        textarea.value = content;
        textarea.className = 'marktex-clipboard-proxy';
        activeDoc.body.appendChild(textarea);
        textarea.select();
        const success = activeDoc.execCommand('copy');
        activeDoc.body.removeChild(textarea);
        return success;
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
}

function getActiveDocument(): Document {
  const globalDom = globalThis as typeof globalThis & {
    activeDocument?: Document;
    document?: Document;
  };
  const activeDoc = globalDom.activeDocument ?? globalDom.document;
  if (!activeDoc) throw new Error('No active document is available.');
  return activeDoc;
}
