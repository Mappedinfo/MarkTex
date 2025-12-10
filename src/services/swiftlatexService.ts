/**
 * SwiftLaTeX 编译服务
 * 使用 WebAssembly XeTeX 引擎在浏览器中编译 LaTeX 为 PDF
 * 支持中文字体和完整 LaTeX 功能
 */

import type { CompileConfig, CompileResult, CompilationProgress, EngineStatus, FontStatus } from '../types';

// SwiftLaTeX 引擎声明
declare global {
  interface Window {
    XeTeXEngine: any;
    DvipdfmxEngine: any; // XDV 转 PDF 引擎
    PdfTeXEngine: any; // 临时支持PdfTeX
  }
}

// 引擎配置
interface EngineConfig {
  engineUrl: string;
  fontCdn: string;
  maxCompileTime: number;
  enableCache: boolean;
}

// 事件监听器类型
type ProgressListener = (progress: CompilationProgress) => void;

/**
 * SwiftLaTeX 编译服务类
 */
export class SwiftLaTeXService {
  private engine: any = null;
  private dvipdfmEngine: any = null; // XDV 转 PDF 引擎
  private engineStatus: EngineStatus = 'unloaded';
  private fontStatus: FontStatus = {};
  private isLoading = false;
  private progressListeners: Set<ProgressListener> = new Set();
  
  // 默认配置
  private config: EngineConfig = {
    // 临时使用 PdfTeX 引擎测试（不支持中文，但更稳定）
    // TODO: 修复 XeTeX 引擎的格式文件问题后切换回来
    engineUrl: '/swiftlatex/SwiftLaTeX-20022022/pdftex.wasm/PdfTeXEngine.js',
    fontCdn: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese',
    maxCompileTime: 30000,
    enableCache: true,
  };

  // 中文字体文件配置
  private readonly fonts = {
    regular: 'NotoSansCJKsc-Regular.otf',
    bold: 'NotoSansCJKsc-Bold.otf',
  };

  /**
   * 检查引擎是否已加载
   */
  isEngineLoaded(): boolean {
    // 检查 PdfTeX 或 XeTeX 是否已加载
    return typeof window.PdfTeXEngine !== 'undefined' || typeof window.XeTeXEngine !== 'undefined';
  }

  /**
   * 获取引擎状态
   */
  getEngineStatus(): EngineStatus {
    return this.engineStatus;
  }

  /**
   * 获取字体状态
   */
  getFontStatus(): FontStatus {
    return { ...this.fontStatus };
  }

  /**
   * 订阅编译进度
   */
  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /**
   * 发送进度更新
   */
  private emitProgress(progress: CompilationProgress): void {
    this.progressListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        console.error('Progress listener error:', error);
      }
    });
  }

  /**
   * 加载 XeTeX 引擎脚本
   */
  async loadEngine(): Promise<void> {
    if (this.isEngineLoaded()) {
      console.log('✅ XeTeX 引擎已加载');
      return Promise.resolve();
    }

    if (this.isLoading) {
      // 等待正在进行的加载
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isEngineLoaded() || this.engineStatus === 'error') {
            clearInterval(checkInterval);
            if (this.engineStatus === 'error') {
              throw new Error('引擎加载失败');
            }
            resolve();
          }
        }, 100);
      });
    }

    this.isLoading = true;
    this.engineStatus = 'loading';
    this.emitProgress({
      stage: 'engine-loading',
      progress: 10,
      message: '正在加载 XeTeX 编译引擎...',
    });

    // 加载 XeTeX 引擎
    const xetexPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.config.engineUrl;
      script.async = true;

      script.onload = () => {
        console.log('✅ XeTeX 引擎加载成功');
        resolve(true);
      };

      script.onerror = () => {
        console.error('❌ XeTeX 引擎加载失败');
        reject(new Error('无法加载 XeTeX 引擎'));
      };

      document.head.appendChild(script);
    });

    // 加载 DvipdfmxEngine (注意: 需要先编译 swiftlatexdvipdfm.js)
    // TODO: 编译 dvipdfmx.wasm 引擎
    const dvipdfmPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = '/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm/DvipdfmxEngine.js';
      script.async = true;

      script.onload = () => {
        console.log('✅ DvipdfmxEngine 加载成功');
        resolve(true);
      };

      script.onerror = () => {
        console.warn('⚠️ DvipdfmxEngine 加载失败 - swiftlatexdvipdfm.js 缺失');
        console.warn('请执行: cd public/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm && make');
        // 不 reject,让系统继续运行，但会在编译时提示错误
        resolve(false);
      };

      document.head.appendChild(script);
    });

    try {
      await Promise.all([xetexPromise, dvipdfmPromise]);
      
      // 等待引擎脚本完全执行并注册全局变量
      // 脚本加载完成后需要一点时间来执行并将构造函数挂载到 window 对象
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 检查引擎是否已注册到 window 对象
      console.log('🔍 检查全局引擎对象:');
      console.log('  - window.XeTeXEngine:', typeof window.XeTeXEngine);
      console.log('  - window.DvipdfmxEngine:', typeof window.DvipdfmxEngine);
      console.log('  - window.PdfTeXEngine:', typeof window.PdfTeXEngine);
      
      this.isLoading = false;
      this.emitProgress({
        stage: 'engine-loading',
        progress: 20,
        message: 'XeTeX 引擎加载完成',
      });
    } catch (error) {
      this.isLoading = false;
      this.engineStatus = 'error';
      this.emitProgress({
        stage: 'error',
        progress: 0,
        message: '引擎加载失败,请检查文件路径',
      });
      throw error;
    }
  }

  /**
   * 初始化引擎实例
   */
  async initialize(): Promise<void> {
    if (this.engine && this.engineStatus === 'ready') {
      console.log('✅ 引擎已初始化');
      return Promise.resolve();
    }

    await this.loadEngine();

    try {
      this.emitProgress({
        stage: 'engine-loading',
        progress: 25,
        message: '正在初始化引擎实例...',
      });

      // 创建引擎实例（优先 PdfTeX，其次 XeTeX）
      if (typeof window.PdfTeXEngine !== 'undefined') {
        this.engine = new window.PdfTeXEngine();
        console.log('使用 PdfTeX 引擎');
        console.log('PdfTeX 引擎实例:', this.engine);
      } else if (typeof window.XeTeXEngine !== 'undefined') {
        this.engine = new window.XeTeXEngine();
        console.log('使用 XeTeX 引擎');
        console.log('XeTeX 引擎实例:', this.engine);
      } else {
        throw new Error('未找到可用的 LaTeX 引擎');
      }
      
      // 创建 DvipdfmxEngine 实例 (如果可用)
      if (typeof window.DvipdfmxEngine !== 'undefined') {
        this.dvipdfmEngine = new window.DvipdfmxEngine();
        console.log('使用 DvipdfmxEngine');
      } else {
        console.warn('⚠️ DvipdfmxEngine 不可用 - XDV 到 PDF 转换将失败');
        console.warn('请编译 dvipdfmx: cd public/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm && make');
      }
      
      // 加载引擎
      console.log('🔧 开始加载 XeTeX 引擎...');
      await this.engine.loadEngine();
      console.log('✅ XeTeX 引擎 loadEngine 完成');
      
      if (this.dvipdfmEngine) {
        console.log('🔧 开始加载 DvipdfmxEngine...');
        await this.dvipdfmEngine.loadEngine();
        console.log('✅ DvipdfmxEngine loadEngine 完成');
      }

      // 检查引擎是否就绪
      if (!this.engine.isReady()) {
        throw new Error('引擎初始化后未就绪');
      }
      
      if (this.dvipdfmEngine && !this.dvipdfmEngine.isReady()) {
        console.warn('⚠️ DvipdfmxEngine 初始化失败');
        this.dvipdfmEngine = null;
      }

      this.engineStatus = 'ready';
      const engineInfo = this.dvipdfmEngine 
        ? 'XeTeX + DvipdfmxEngine' 
        : 'XeTeX 单独模式 (仅生成 XDV)';
      console.log(`✅ ${engineInfo} 引擎实例初始化成功`);
      
      // 🔧 生成格式文件（首次初始化时）
      console.log('🔧 开始生成格式文件...');
      this.emitProgress({
        stage: 'engine-loading',
        progress: 35,
        message: '正在生成格式文件...',
      });
      
      try {
        // 首先需要加载 pdflatex.ini 文件到虚拟文件系统
        console.log('📝 加载 pdflatex.ini 文件...');
        const iniResponse = await fetch('/swiftlatex/SwiftLaTeX-20022022/pdftex.wasm/pdflatex.ini');
        const iniContent = await iniResponse.text();
        this.engine.writeMemFSFile('pdflatex.ini', iniContent);
        console.log('✅ pdflatex.ini 文件已加载');
        
        await this.engine.compileFormat();
        console.log('✅ 格式文件生成成功');
      } catch (formatError) {
        console.warn('⚠️ 格式文件生成失败，尝试继续:', formatError);
        // 即使格式文件生成失败，也继续初始化
      }
      
      this.emitProgress({
        stage: 'engine-loading',
        progress: 30,
        message: '引擎初始化完成',
      });
    } catch (error) {
      console.error('❌ XeTeX 引擎实例初始化失败:', error);
      this.engineStatus = 'error';
      throw new Error('XeTeX 引擎初始化失败');
    }
  }

  /**
   * 加载中文字体
   */
  async loadFont(fontName: keyof typeof this.fonts): Promise<void> {
    const fontFile = this.fonts[fontName];
    
    if (this.fontStatus[fontName] === 'loaded') {
      console.log(`✅ 字体 ${fontFile} 已加载`);
      return;
    }

    this.fontStatus[fontName] = 'loading';
    this.emitProgress({
      stage: 'font-loading',
      progress: 35,
      message: `正在加载 ${fontName} 字体...`,
    });

    try {
      const fontUrl = `${this.config.fontCdn}/${fontFile}`;
      console.log(`🔄 开始下载字体: ${fontUrl}`);

      const response = await fetch(fontUrl);
      if (!response.ok) {
        throw new Error(`字体下载失败: ${response.status}`);
      }

      const fontData = await response.arrayBuffer();
      const uint8Array = new Uint8Array(fontData);

      // 写入虚拟文件系统
      const vfsPath = `/fonts/${fontFile}`;
      this.engine.makeMemFSFolder('/fonts');
      // 等待一小段时间确保文件夹创建完成
      await new Promise(resolve => setTimeout(resolve, 100));
      this.engine.writeMemFSFile(vfsPath, uint8Array);
      // 等待文件写入完成
      await new Promise(resolve => setTimeout(resolve, 100));

      this.fontStatus[fontName] = 'loaded';
      console.log(`✅ 字体 ${fontFile} 加载成功`);
      
      this.emitProgress({
        stage: 'font-loading',
        progress: 40,
        message: `${fontName} 字体加载完成`,
      });
    } catch (error: any) {
      console.error(`❌ 字体 ${fontFile} 加载失败:`, error);
      this.fontStatus[fontName] = 'error';
      throw new Error(`字体加载失败: ${error.message}`);
    }
  }

  /**
   * 加载必需的中文字体
   */
  async loadChineseFonts(): Promise<void> {
    // 加载常规字体(必需)
    await this.loadFont('regular');
    
    // 粗体字体可以稍后按需加载,这里先跳过以加快初始化
    // await this.loadFont('bold');
  }

  /**
   * 生成格式文件（首次初始化时调用）
   * 注意：由于 Worker 的限制，这个功能目前难以实现
   * 我们需要预先生成格式文件并部署到项目中
   */
  async generateFormatFile(): Promise<boolean> {
    if (!this.engine) {
      throw new Error('引擎未初始化');
    }

    try {
      console.log('🔧 开始生成格式文件...');
      console.warn('⚠️ 此功能尚未完全实现，需要预先生成格式文件');
      
      // 调用引擎的 compileFormat 方法
      await this.engine.compileFormat();
      
      console.log('✅ 格式文件生成完成（但需要手动导出）');
      return true;
    } catch (error) {
      console.error('❌ 格式文件生成失败:', error);
      return false;
    }
  }

  /**
   * 编译 LaTeX 源码为 PDF
   */
  async compile(latexContent: string, _config?: Partial<CompileConfig>): Promise<CompileResult> {
    // 确保引擎已初始化
    await this.initialize();

    try {
      this.emitProgress({
        stage: 'file-preparing',
        progress: 45,
        message: '准备 LaTeX 源文件...',
      });

      // 检测是否包含中文,如果包含则加载中文字体
      const hasChinese = /[\u4e00-\u9fa5]/.test(latexContent);
      if (hasChinese && this.fontStatus['regular'] !== 'loaded') {
        await this.loadChineseFonts();
      }

      // 清空之前的文件
      this.engine.flushCache();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 写入主 LaTeX 文件
      console.log('📝 写入 LaTeX 源文件...');
      console.log('LaTeX 内容预览:', latexContent.substring(0, 500));
      
      // 测试：先尝试编译一个最简单的文档
      const testSimple = true; // 设置为 true 来测试最简单的文档
      if (testSimple) {
        console.log('⚠️ 使用简化测试文档');
        latexContent = `\\documentclass{article}
\\begin{document}
Hello World
\\end{document}`;
      }
      
      this.engine.writeMemFSFile('main.tex', latexContent);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.engine.setEngineMainFile('main.tex');
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('🔄 开始编译 LaTeX...');
      this.emitProgress({
        stage: 'compiling',
        progress: 50,
        message: '正在编译文档...',
      });

      // 执行编译
      const result = await this.engine.compileLaTeX();
      
      console.log('📊 编译结果:', {
        status: result.status,
        hasLog: !!result.log,
        hasPdf: !!result.pdf,
        logLength: result.log?.length || 0,
        pdfLength: result.pdf?.length || 0
      });
      
      // 输出详细的编译日志
      if (result.log) {
        console.log('📜 编译日志详情:');
        console.log(result.log);
      } else {
        console.warn('⚠️ 没有编译日志输出！');
      }

      this.emitProgress({
        stage: 'generating-pdf',
        progress: 70,
        message: '正在生成 PDF...',
      });

      // 检查是否使用 XeTeX（需要 dvipdfmx 转换）
      const isXeTeX = typeof window.XeTeXEngine !== 'undefined' && 
                      this.engine.constructor.name === 'XeTeXEngine';

      // XeTeX 生成的是 XDV 文件,需要用 dvipdfmx 转换为 PDF
      if (isXeTeX && result.status === 0 && result.pdf) {
        console.log('🔄 XeTeX 编译成功,开始转换 XDV 到 PDF...');
        
        // 检查 dvipdfmx 引擎是否可用
        if (!this.dvipdfmEngine) {
          console.error('❌ DvipdfmxEngine 不可用,无法将 XDV 转换为 PDF');
          
          this.emitProgress({
            stage: 'error',
            progress: 0,
            message: 'dvipdfmx 引擎缺失',
          });
          
          return {
            success: false,
            log: result.log || '',
            error: `DvipdfmxEngine 不可用

请编译 dvipdfmx 引擎:
cd public/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm
make

或者使用 PdfTeX 引擎（不支持中文）`,
          };
        }
        
        // 将 XDV 数据写入 dvipdfmx 引擎
        const xdvFilename = 'main.xdv';
        this.dvipdfmEngine.writeMemFSFile(xdvFilename, result.pdf);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.dvipdfmEngine.setEngineMainFile(xdvFilename);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 转换为 PDF
        const pdfResult = await this.dvipdfmEngine.compilePDF();
        
        console.log('📊 XDV 转 PDF 结果:', {
          status: pdfResult.status,
          hasPdf: !!pdfResult.pdf,
        });
        
        if (pdfResult.pdf) {
          console.log('✅ PDF 生成成功');
          this.emitProgress({
            stage: 'complete',
            progress: 100,
            message: '编译完成',
          });

          return {
            success: true,
            pdf: pdfResult.pdf,
            log: result.log || '',
          };
        } else {
          console.error('❌ XDV 转 PDF 失败');
          console.error('Dvipdfmx 日志:', pdfResult.log);
          
          return {
            success: false,
            log: `XeTeX 编译日志:
${result.log || ''}

Dvipdfmx 转换日志:
${pdfResult.log || ''}`,
            error: `XDV 转 PDF 失败 (状态码: ${pdfResult.status})`,
          };
        }
      } else if (result.status === 0 && result.pdf) {
        // PdfTeX 直接生成 PDF
        console.log('✅ PDF 生成成功 (PdfTeX)');
        this.emitProgress({
          stage: 'complete',
          progress: 100,
          message: '编译完成',
        });

        return {
          success: true,
          pdf: result.pdf,
          log: result.log || '',
        };
      } else {
        console.error('❌ 编译失败,未生成 XDV');
        console.error('编译状态码:', result.status);
        console.error('编译日志:', result.log);
        console.error('完整结果:', result);
        
        this.emitProgress({
          stage: 'error',
          progress: 0,
          message: '编译失败',
        });

        return {
          success: false,
          log: result.log || '无编译日志输出',
          error: `编译失败 (状态码: ${result.status})`,
        };
      }
    } catch (error: any) {
      console.error('❌ 编译过程出错:', error);
      this.emitProgress({
        stage: 'error',
        progress: 0,
        message: `编译错误: ${error.message}`,
      });

      return {
        success: false,
        error: `编译失败: ${error.message || '未知错误'}`,
      };
    }
  }

  /**
   * 创建 PDF 的 Blob URL
   */
  createPdfUrl(pdfData: Uint8Array): string {
    const blob = new Blob([pdfData as any], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.engine) {
      try {
        this.engine.closeWorker();
      } catch (error) {
        console.error('清理 XeTeX 引擎时出错:', error);
      }
    }
    if (this.dvipdfmEngine) {
      try {
        this.dvipdfmEngine.closeWorker();
      } catch (error) {
        console.error('清理 DvipdfmxEngine 时出错:', error);
      }
    }
    this.engine = null;
    this.dvipdfmEngine = null;
    this.engineStatus = 'unloaded';
    this.fontStatus = {};
    this.progressListeners.clear();
  }
}

// 导出单例实例
export const swiftlatexService = new SwiftLaTeXService();
