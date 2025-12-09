/**
 * 前端 PDF 编译服务
 * 使用 WebAssembly LaTeX 引擎在浏览器中编译 LaTeX 为 PDF
 */

declare global {
  interface Window {
    PDFTeX: any;
  }
}

export class FrontendPdfService {
  private pdftex: any = null;
  private isInitialized = false;
  private isLoading = false;

  /**
   * 检查 PDFTeX 引擎是否已加载
   */
  isEngineLoaded(): boolean {
    return typeof window.PDFTeX !== 'undefined';
  }

  /**
   * 加载 PDFTeX 引擎（从 CDN）
   */
  async loadEngine(): Promise<void> {
    if (this.isEngineLoaded()) {
      return Promise.resolve();
    }

    if (this.isLoading) {
      // 等待正在进行的加载
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isEngineLoaded()) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    this.isLoading = true;

    return new Promise((resolve, reject) => {
      // 加载 PDFTeX 脚本
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/texlive@1.2.0/pdftex.js';
      script.async = true;

      script.onload = () => {
        console.log('✅ PDFTeX 引擎加载成功');
        this.isLoading = false;
        resolve();
      };

      script.onerror = () => {
        console.error('❌ PDFTeX 引擎加载失败');
        this.isLoading = false;
        reject(new Error('无法加载 PDFTeX 引擎'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * 初始化 PDFTeX 实例
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    await this.loadEngine();

    try {
      // 创建 PDFTeX 实例
      this.pdftex = new window.PDFTeX();
      
      // 设置日志回调
      this.pdftex.on_stdout = (msg: string) => {
        console.log('[PDFTeX stdout]', msg);
      };

      this.pdftex.on_stderr = (msg: string) => {
        console.warn('[PDFTeX stderr]', msg);
      };

      this.isInitialized = true;
      console.log('✅ PDFTeX 实例初始化成功');
    } catch (error) {
      console.error('❌ PDFTeX 实例初始化失败:', error);
      throw new Error('PDFTeX 初始化失败');
    }
  }

  /**
   * 编译 LaTeX 源码为 PDF
   * @param latexContent LaTeX 源码
   * @returns PDF 的 data URL
   */
  async compile(latexContent: string): Promise<string> {
    await this.initialize();

    try {
      console.log('🔄 开始前端编译 LaTeX...');
      
      // 编译 LaTeX
      const pdfDataUrl = await this.pdftex.compile(latexContent);

      if (!pdfDataUrl) {
        throw new Error('编译失败，未生成 PDF');
      }

      console.log('✅ 前端编译成功');
      return pdfDataUrl;
    } catch (error: any) {
      console.error('❌ 前端编译失败:', error);
      throw new Error(`编译失败: ${error.message || '未知错误'}`);
    }
  }

  /**
   * 将 Data URL 转换为 Blob
   */
  dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const contentType = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: contentType });
  }

  /**
   * 创建 PDF 的 Blob URL
   */
  createPdfUrl(dataUrl: string): string {
    const blob = this.dataUrlToBlob(dataUrl);
    return URL.createObjectURL(blob);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.pdftex = null;
    this.isInitialized = false;
  }
}

// 导出单例实例
export const frontendPdfService = new FrontendPdfService();
