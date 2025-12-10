/**
 * LaTeX 预览组件
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { swiftlatexService } from '../services/swiftlatexService';
import './MarkdownEditor.css';

export function LatexPreview() {
  const {
    latexOutput,
    previewMode,
    setPreviewMode,
    compileError,
    setCompileError,
    pdfUrl,
    setPdfUrl,
    isCompiling,
    setIsCompiling,
    engineStatus,
    setEngineStatus,
    compilationStage,
    setCompilationStage,
    compilationProgress,
    setCompilationProgress,
  } = useAppStore();

  // 设置进度监听器
  useEffect(() => {
    const unsubscribe = swiftlatexService.onProgress((progress) => {
      setCompilationStage(progress.stage);
      setCompilationProgress(progress.progress);
    });

    return unsubscribe;
  }, [setCompilationStage, setCompilationProgress]);

  // 编译 PDF（使用 SwiftLaTeX 纯前端编译）
  const handleCompilePdf = async () => {
    if (!latexOutput) return;

    setIsCompiling(true);
    setCompileError(null);
    setCompilationStage('idle');
    setCompilationProgress(0);

    // 清理旧的 PDF URL
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    try {
      console.log('🎯 开始使用 SwiftLaTeX 编译...');
      
      // 更新引擎状态
      const currentStatus = swiftlatexService.getEngineStatus();
      setEngineStatus(currentStatus);
      
      // 执行编译
      const result = await swiftlatexService.compile(latexOutput);
      
      if (result.success && result.pdf) {
        const url = swiftlatexService.createPdfUrl(result.pdf);
        setPdfUrl(url);
        console.log('✅ SwiftLaTeX 编译成功');
        setEngineStatus('ready');
        setCompileError(null); // 清除错误
      } else {
        const errorMessage = result.error || '编译失败';
        console.error('❌ 编译失败:', errorMessage);
        console.log('编译日志:', result.log);
        
        // SwiftLaTeX 引擎需要格式文件，目前暂不可用
        setCompileError(`⚠️ PDF 预览功能暂时不可用

SwiftLaTeX 引擎需要预编译的格式文件（.fmt）才能运行。

请使用以下替代方案：
1. 点击“导出 LaTeX”按钮获取 .tex 源文件
2. 在本地使用 XeLaTeX 编译（已安装 TeX Live 或 MiKTeX）
3. 或使用在线 LaTeX 编辑器（如 Overleaf）

技术详情：
${errorMessage}

编译日志：
${result.log || '无日志信息'}`);
      }
    } catch (error: any) {
      console.error('❌ 编译过程出错:', error);
      setCompileError(`编译失败: ${error.message}`);
      setEngineStatus('error');
    } finally {
      setIsCompiling(false);
      setCompilationStage('idle');
    }
  };

  // 切换到 PDF 模式时自动编译
  useEffect(() => {
    if (previewMode === 'pdf' && !pdfUrl && !isCompiling) {
      handleCompilePdf();
    }
  }, [previewMode]);

  // 清理 PDF URL
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div className="latex-preview">
      <div className="preview-header">
        <h2>LaTeX 预览</h2>
        <div className="preview-actions">
          <div className="preview-mode-toggle">
            <button
              className={`mode-btn ${previewMode === 'source' ? 'active' : ''}`}
              onClick={() => setPreviewMode('source')}
              title="源码模式"
            >
              源码
            </button>
            <button
              className={`mode-btn ${previewMode === 'pdf' ? 'active' : ''}`}
              onClick={() => setPreviewMode('pdf')}
              title="PDF 预览（纯前端 SwiftLaTeX 编译）"
            >
              PDF
            </button>
          </div>
          <span className="preview-info">
            {latexOutput.split('\n').length} 行
            {engineStatus !== 'unloaded' && (
              <span className="engine-status">
                {' '}| 🌐 {engineStatus === 'ready' ? '引擎就绪' : engineStatus === 'loading' ? '加载中...' : engineStatus === 'error' ? '引擎错误' : '未加载'}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 错误显示区域 */}
      {compileError && (
        <div className="compile-error">
          <div className="error-header">
            <span className="error-icon">⚠️</span>
            <strong>编译错误</strong>
          </div>
          <pre className="error-content">{compileError}</pre>
        </div>
      )}

      <div className="preview-body">
        {previewMode === 'source' ? (
          <pre>{latexOutput}</pre>
        ) : (
          <div className="pdf-preview-container">
            {isCompiling ? (
              <div className="pdf-preview-placeholder">
                <div className="placeholder-content">
                  <div className="loading-spinner"></div>
                  <h3>正在编译 PDF...</h3>
                  <p>{compilationStage === 'engine-loading' && '加载编译引擎...'}</p>
                  <p>{compilationStage === 'font-loading' && '加载中文字体...'}</p>
                  <p>{compilationStage === 'file-preparing' && '准备源文件...'}</p>
                  <p>{compilationStage === 'compiling' && '正在编译文档...'}</p>
                  <p>{compilationStage === 'generating-pdf' && '生成 PDF 文件...'}</p>
                  {compilationProgress > 0 && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${compilationProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            ) : pdfUrl ? (
              <>
                <div className="pdf-toolbar">
                  <button onClick={handleCompilePdf} className="btn-refresh">
                    🔄 重新编译
                  </button>
                  <a
                    href={pdfUrl}
                    download="document.pdf"
                    className="btn-download-pdf"
                  >
                    📥 下载 PDF
                  </a>
                </div>
                <iframe
                  src={pdfUrl}
                  className="pdf-iframe"
                  title="PDF Preview"
                />
              </>
            ) : (
              <div className="pdf-preview-placeholder">
                <div className="placeholder-content">
                  <h3>📄 准备好编译</h3>
                  <button onClick={handleCompilePdf} className="btn-compile">
                    开始编译 PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
