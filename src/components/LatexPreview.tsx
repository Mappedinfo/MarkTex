/**
 * LaTeX 预览组件
 */

import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { PdfCompileService } from '../services/pdfCompileService';
import { frontendPdfService } from '../services/frontendPdfService';
import './MarkdownEditor.css';

const pdfService = new PdfCompileService();

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
  } = useAppStore();

  const [serverAvailable, setServerAvailable] = useState(false);
  const [compilationMode, setCompilationMode] = useState<'frontend' | 'backend' | null>(null);

  // 检查后端服务是否可用
  useEffect(() => {
    pdfService.checkHealth().then(setServerAvailable);
  }, []);

  // 编译 PDF（双模式：优先前端，失败则尝试后端）
  const handleCompilePdf = async () => {
    if (!latexOutput) return;

    setIsCompiling(true);
    setCompileError(null);
    setCompilationMode(null);

    // 清理旧的 PDF URL
    if (pdfUrl) {
      if (pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      } else {
        pdfService.revokePdfUrl(pdfUrl);
      }
      setPdfUrl(null);
    }

    try {
      // 尝试前端编译
      console.log('🎯 尝试使用前端 WebAssembly 编译...');
      setCompilationMode('frontend');
      
      const pdfDataUrl = await frontendPdfService.compile(latexOutput);
      const url = frontendPdfService.createPdfUrl(pdfDataUrl);
      setPdfUrl(url);
      console.log('✅ 前端编译成功');
    } catch (frontendError: any) {
      console.warn('⚠️ 前端编译失败:', frontendError.message);
      
      // 如果后端服务可用，尝试后端编译
      if (serverAvailable) {
        try {
          console.log('🔄 切换到后端编译...');
          setCompilationMode('backend');
          const pdfBlob = await pdfService.compileToPdf(latexOutput);
          const url = pdfService.createPdfUrl(pdfBlob);
          setPdfUrl(url);
          console.log('✅ 后端编译成功');
        } catch (backendError: any) {
          console.error('❌ 后端编译也失败:', backendError.message);
          setCompileError(
            `前端编译失败: ${frontendError.message}\n\n后端编译失败: ${backendError.message}`
          );
        }
      } else {
        setCompileError(
          `前端编译失败: ${frontendError.message}\n\n提示: 后端服务不可用，无法尝试备用编译方案`
        );
      }
    } finally {
      setIsCompiling(false);
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
        if (pdfUrl.startsWith('blob:')) {
          URL.revokeObjectURL(pdfUrl);
        } else {
          pdfService.revokePdfUrl(pdfUrl);
        }
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
              title="PDF 预览（优先使用前端编译）"
            >
              PDF
            </button>
          </div>
          <span className="preview-info">
            {latexOutput.split('\n').length} 行
            {compilationMode && (
              <span className="compilation-mode">
                {' '}| {compilationMode === 'frontend' ? '🌐 前端编译' : '🖥️ 后端编译'}
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
                  <p>请稍候，这可能需要几秒钟</p>
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
