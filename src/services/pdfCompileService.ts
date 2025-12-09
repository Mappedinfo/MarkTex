/**
 * PDF 编译服务
 * 调用后端 API 编译 LaTeX 为 PDF
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class PdfCompileService {
  /**
   * 编译 LaTeX 为 PDF
   * @param latexContent - LaTeX 源码
   * @returns Promise<Blob> - PDF 文件 Blob
   */
  async compileToPdf(latexContent: string): Promise<Blob> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latex: latexContent }),
      });

      if (!response.ok) {
        // 尝试解析错误信息
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.message || error.details || '编译失败');
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      // 返回 PDF Blob
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('PDF 编译失败:', error);
      throw error;
    }
  }

  /**
   * 检查后端服务是否可用
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('后端服务不可用:', error);
      return false;
    }
  }

  /**
   * 获取 PDF 的 URL（用于预览）
   */
  createPdfUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * 释放 PDF URL
   */
  revokePdfUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
