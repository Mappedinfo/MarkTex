/**
 * MarkTex Panel - 可嵌入的 Markdown/LaTeX 编辑面板
 * 作为一个独立的面板组件，可以嵌入到任何 React 应用中
 */

import React, { useEffect, useMemo, useRef, useCallback, useState, createElement } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { createMarkTexStore } from '../stores/storeFactory';
import { LatexRenderer } from '../services/latexRenderer';
import { DocumentGenerator } from '../services/documentGenerator';
import { countMarkdownWords } from '../services/wordCounter';
import { swiftlatexService } from '../services/swiftlatexService';
import { parseWikiLinks } from '../plugins/wikilink';
import type { AppConfig } from '../types';
import './MarkdownEditor.css';
import './MarkTexPanel.css';

export interface MarkTexPanelProps {
  /** 初始内容 */
  initialContent?: string;
  /** 初始配置 */
  initialConfig?: Partial<AppConfig>;
  /** 内容变化回调 */
  onContentChange?: (content: string) => void;
  /** LaTeX 输出变化回调 */
  onLatexChange?: (latex: string) => void;
  /** Wiki-link 点击回调 */
  onWikiLinkClick?: (type: 'node' | 'relation', id: string, label: string) => void;
  /** 笔记保存回调 */
  onNoteSave?: (note: { title: string; content: string }) => Promise<void>;
  /** SwiftLaTeX WASM 资产基础路径 */
  swiftlatexBasePath?: string;
  /** 类名 */
  className?: string;
  /** 样式 */
  style?: React.CSSProperties;
  /** 是否显示预览 */
  showPreview?: boolean;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 是否显示设置面板 */
  showSettings?: boolean;
  /** 初始预览模式 */
  initialPreviewMode?: 'source' | 'pdf' | 'preview';
}

/**
 * MarkTexPanel - 可嵌入的 Markdown/LaTeX 编辑面板
 */
export function MarkTexPanel(props: MarkTexPanelProps = {}) {
  // 防御性检查：确保 props 不为 null
  const safeProps = props || {};
  const {
    initialContent = '',
    initialConfig,
    onContentChange,
    onLatexChange,
    onWikiLinkClick,
    onNoteSave,
    swiftlatexBasePath,
    className,
    style,
    showPreview = true,
    showToolbar = true,
    showSettings = true,
    initialPreviewMode = 'preview',
  } = safeProps;

  // 设置 SwiftLaTeX 基础路径
  useEffect(() => {
    if (swiftlatexBasePath) {
      swiftlatexService.setBasePath(swiftlatexBasePath);
    }
  }, [swiftlatexBasePath]);

  // 创建 store hook
  const useStore = useMemo(() => {
    return createMarkTexStore({
      initialContent,
      config: initialConfig,
    });
  }, []);

  // 使用 store hook 获取状态
  const markdownContent = useStore((s) => s.markdownContent);
  const setMarkdownContent = useStore((s) => s.setMarkdownContent);
  const latexOutput = useStore((s) => s.latexOutput);
  const setLatexOutput = useStore((s) => s.setLatexOutput);
  const config = useStore((s) => s.config);
  const updateConfig = useStore((s) => s.updateConfig);
  const previewMode = useStore((s) => s.previewMode);
  const setPreviewMode = useStore((s) => s.setPreviewMode);
  const compileError = useStore((s) => s.compileError);
  const setCompileError = useStore((s) => s.setCompileError);
  const pdfUrl = useStore((s) => s.pdfUrl);
  const setPdfUrl = useStore((s) => s.setPdfUrl);
  const isCompiling = useStore((s) => s.isCompiling);
  const setIsCompiling = useStore((s) => s.setIsCompiling);
  const setEngineStatus = useStore((s) => s.setEngineStatus);
  const compilationStage = useStore((s) => s.compilationStage);
  const setCompilationStage = useStore((s) => s.setCompilationStage);
  const compilationProgress = useStore((s) => s.compilationProgress);
  const setCompilationProgress = useStore((s) => s.setCompilationProgress);
  const isSettingsPanelOpen = useStore((s) => s.isSettingsPanelOpen);
  const toggleSettingsPanel = useStore((s) => s.toggleSettingsPanel);
  const closeSettingsPanel = useStore((s) => s.closeSettingsPanel);
  const notification = useStore((s) => s.notification);
  const showNotification = useStore((s) => s.showNotification);

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const rendererRef = useRef<LatexRenderer | null>(null);
  const docGeneratorRef = useRef<DocumentGenerator | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');

  // 初始化预览模式
  useEffect(() => {
    if (initialPreviewMode) {
      setPreviewMode(initialPreviewMode);
    }
  }, []);

  // 计算字数统计
  const wordCount = useMemo(() => {
    return countMarkdownWords(markdownContent);
  }, [markdownContent]);

  // 初始化渲染器
  useEffect(() => {
    rendererRef.current = new LatexRenderer(config.table);
    docGeneratorRef.current = new DocumentGenerator();
  }, [config.table]);

  // 初始化 CodeMirror 编辑器
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 初始化编辑器
  useEffect(() => {
    if (!isClient || !editorRef.current) return;

    const startState = EditorState.create({
      doc: markdownContent,
      extensions: [
        lineNumbers(),
        markdown(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            setMarkdownContent(newContent);
            onContentChange?.(newContent);
          }
        }),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [isClient, setMarkdownContent, onContentChange]);

  // 渲染 LaTeX（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rendererRef.current && docGeneratorRef.current) {
        try {
          rendererRef.current.updateTableConfig(config.table);
          const renderResult = rendererRef.current.render(markdownContent);
          const latexDoc = docGeneratorRef.current.generate(renderResult, config.document);
          setLatexOutput(latexDoc);
          onLatexChange?.(latexDoc);
        } catch (error) {
          console.error('LaTeX rendering error:', error);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [markdownContent, config, setLatexOutput, onLatexChange]);

  // 编译 PDF
  const handleCompilePdf = useCallback(async () => {
    if (!latexOutput) return;

    setIsCompiling(true);
    setCompileError(null);
    setCompilationStage('idle');
    setCompilationProgress(0);

    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    try {
      const result = await swiftlatexService.compile(latexOutput);

      if (result.success && result.pdf) {
        const url = swiftlatexService.createPdfUrl(result.pdf);
        setPdfUrl(url);
        setEngineStatus('ready');
        setCompileError(null);
      } else {
        const errorMessage = result.error || '编译失败';
        setCompileError(`⚠️ PDF 预览功能暂时不可用\n\n请使用以下替代方案：\n1. 点击"导出 LaTeX"按钮获取 .tex 源文件\n2. 在本地使用 XeLaTeX 编译\n\n技术详情：${errorMessage}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCompileError(`编译失败: ${errorMessage}`);
      setEngineStatus('error');
    } finally {
      setIsCompiling(false);
      setCompilationStage('idle');
    }
  }, [latexOutput, pdfUrl, setIsCompiling, setCompileError, setCompilationStage, setCompilationProgress, setPdfUrl, setEngineStatus]);

  // 切换到 PDF 模式时自动编译
  useEffect(() => {
    if (previewMode === 'pdf' && !pdfUrl && !isCompiling) {
      handleCompilePdf();
    }
  }, [previewMode, pdfUrl, isCompiling, handleCompilePdf]);

  // 复制 LaTeX
  const handleCopyLatex = useCallback(() => {
    navigator.clipboard.writeText(latexOutput).then(() => {
      showNotification('LaTeX 代码已复制', 'success');
    });
  }, [latexOutput, showNotification]);

  // 复制 Markdown
  const handleCopyMarkdown = useCallback(() => {
    navigator.clipboard.writeText(markdownContent).then(() => {
      showNotification('Markdown 代码已复制', 'success');
    });
  }, [markdownContent, showNotification]);

  // 处理 Wiki-link 点击
  const handleWikiLinkClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      const target = e.currentTarget;
      const type = target.classList.contains('wikilink-node') ? 'node' : 'relation';
      const id = target.dataset.id || target.dataset.type || '';
      const label = target.dataset.label || target.textContent || '';
      onWikiLinkClick?.(type, id, label);
    },
    [onWikiLinkClick]
  );

  // 保存笔记
  const handleSaveNote = useCallback(async () => {
    if (!markdownContent.trim()) {
      showNotification('内容不能为空', 'error');
      return;
    }

    try {
      await onNoteSave?.({ title: noteTitle || '无标题', content: markdownContent });
      showNotification('笔记已保存', 'success');
    } catch (error) {
      showNotification('保存失败', 'error');
    }
  }, [noteTitle, markdownContent, onNoteSave, showNotification]);

  // 解析 markdown 内容为 HTML（包含 wiki-links）
  const renderMarkdownPreview = useCallback(() => {
    const lines = markdownContent.split('\n');
    return lines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      const wikiLinks = parseWikiLinks(line);
      let lastIndex = 0;

      wikiLinks.forEach((link, i) => {
        // 添加链接前的文本
        if (link.start > lastIndex) {
          parts.push(<span key={`text-${lineIndex}-${i}`}>{line.slice(lastIndex, link.start)}</span>);
        }

        // 添加 wiki-link
        if (link.type === 'node') {
          parts.push(
            <span
              key={`wikilink-${lineIndex}-${i}`}
              className="wikilink-node"
              data-id={link.target || ''}
              data-label={link.displayText}
              onClick={handleWikiLinkClick}
              style={{
                color: '#1890ff',
                backgroundColor: '#e6f7ff',
                padding: '2px 6px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {link.displayText}
            </span>
          );
        } else if (link.type === 'relation') {
          parts.push(
            <span
              key={`wikilink-${lineIndex}-${i}`}
              className="wikilink-relation"
              data-type={link.target || link.displayText}
              onClick={handleWikiLinkClick}
              style={{
                color: '#52c41a',
                backgroundColor: '#f6ffed',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px dashed #b7eb8f',
                cursor: 'pointer',
              }}
            >
              {link.displayText}
            </span>
          );
        }

        lastIndex = link.end;
      });

      // 添加剩余文本
      if (lastIndex < line.length) {
        parts.push(<span key={`text-end-${lineIndex}`}>{line.slice(lastIndex)}</span>);
      }

      // 处理标题和列表等 Markdown 语法
      let renderedLine = parts.length > 0 ? parts : [line];
      let tag: 'h1' | 'h2' | 'h3' | 'li' | 'p' = 'p';

      if (line.startsWith('# ')) {
        tag = 'h1';
        renderedLine = [line.slice(2)];
      } else if (line.startsWith('## ')) {
        tag = 'h2';
        renderedLine = [line.slice(3)];
      } else if (line.startsWith('### ')) {
        tag = 'h3';
        renderedLine = [line.slice(4)];
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        tag = 'li';
        renderedLine = [line.slice(2)];
      } else if (/^\d+\.\s/.test(line)) {
        tag = 'li';
        renderedLine = [line.replace(/^\d+\.\s/, '')];
      } else if (line.trim() === '') {
        return createElement('br', { key: `br-${lineIndex}` });
      }

      return createElement(tag, { key: lineIndex }, renderedLine);
    });
  }, [markdownContent, handleWikiLinkClick]);

  return (
    <div className={`marktex-panel ${className || ''}`} style={style}>
      {/* 通知 */}
      {notification.show && (
        <div className={`marktex-notification marktex-notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="marktex-main">
        {/* 左侧：编辑器 */}
        <div className="marktex-editor-section">
          {showToolbar && (
            <div className="marktex-toolbar">
              <span className="toolbar-title">Markdown 编辑器</span>
              <div className="toolbar-actions">
                <input
                  type="text"
                  className="toolbar-title-input"
                  placeholder="笔记标题..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
                <button onClick={handleSaveNote} title="保存笔记" className="btn-save">
                  保存
                </button>
                <button onClick={handleCopyMarkdown} title="复制 Markdown">
                  复制
                </button>
              </div>
            </div>
          )}

          <div className="marktex-editor">
            <div className="editor-body" ref={editorRef}></div>
          </div>

          <div className="editor-stats">
            <span>总计: {wordCount.totalWords} 词</span>
            <span>|</span>
            <span>正文: {wordCount.bodyWords} 词</span>
            <span>|</span>
            <span>表格: {wordCount.tableWords} 词</span>
            <span>|</span>
            <span>{markdownContent.split('\n').length} 行</span>
          </div>
        </div>

        {/* 右侧：预览 */}
        {showPreview && (
          <div className="marktex-preview-section">
            <div className="marktex-toolbar">
              <span className="toolbar-title">预览</span>
              <div className="toolbar-actions">
                <div className="preview-mode-toggle">
                  <button
                    className={previewMode === 'preview' ? 'active' : ''}
                    onClick={() => setPreviewMode('preview')}
                  >
                    预览
                  </button>
                  <button
                    className={previewMode === 'source' ? 'active' : ''}
                    onClick={() => setPreviewMode('source')}
                  >
                    源码
                  </button>
                  <button
                    className={previewMode === 'pdf' ? 'active' : ''}
                    onClick={() => setPreviewMode('pdf')}
                  >
                    PDF
                  </button>
                </div>
                <button onClick={handleCopyLatex} title="复制 LaTeX">
                  复制
                </button>
                {showSettings && (
                  <button onClick={toggleSettingsPanel} title="设置">
                    设置
                  </button>
                )}
              </div>
            </div>

            <div className="preview-body">
              {previewMode === 'preview' ? (
                <div className="markdown-preview">{renderMarkdownPreview()}</div>
              ) : previewMode === 'source' ? (
                <pre className="latex-source">{latexOutput}</pre>
              ) : (
                <div className="pdf-preview-container">
                  {isCompiling ? (
                    <div className="pdf-preview-placeholder">
                      <div className="loading-spinner"></div>
                      <h3>正在编译 PDF...</h3>
                      <p>{compilationStage === 'engine-loading' && '加载编译引擎...'}</p>
                      <p>{compilationStage === 'font-loading' && '加载中文字体...'}</p>
                      <p>{compilationStage === 'compiling' && '正在编译文档...'}</p>
                      {compilationProgress > 0 && (
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${compilationProgress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ) : pdfUrl ? (
                    <>
                      <div className="pdf-toolbar">
                        <button onClick={handleCompilePdf} className="btn-refresh">
                          重新编译
                        </button>
                        <a href={pdfUrl} download="document.pdf" className="btn-download-pdf">
                          下载 PDF
                        </a>
                      </div>
                      <iframe
                        src={pdfUrl}
                        className="pdf-iframe"
                        title="PDF Preview"
                      />
                    </>
                  ) : compileError ? (
                    <div className="compile-error">
                      <pre>{compileError}</pre>
                    </div>
                  ) : (
                    <div className="pdf-preview-placeholder">
                      <button onClick={handleCompilePdf} className="btn-compile">
                        开始编译 PDF
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 设置面板 */}
        {showSettings && isSettingsPanelOpen && (
          <div className="marktex-settings-panel">
            <div className="settings-header">
              <h3>设置</h3>
              <button onClick={closeSettingsPanel}>×</button>
            </div>

            <div className="settings-content">
              <div className="settings-section">
                <h4>文档设置</h4>
                <label>
                  文档类：
                  <select
                    value={config.document.documentClass}
                    onChange={(e) =>
                      updateConfig({
                        document: { ...config.document, documentClass: e.target.value as 'article' | 'report' | 'book' },
                      })
                    }
                  >
                    <option value="article">article（文章）</option>
                    <option value="report">report（报告）</option>
                    <option value="book">book（书籍）</option>
                  </select>
                </label>

                <label>
                  字体大小：
                  <select
                    value={config.document.fontSize}
                    onChange={(e) =>
                      updateConfig({
                        document: { ...config.document, fontSize: e.target.value as '10pt' | '11pt' | '12pt' },
                      })
                    }
                  >
                    <option value="10pt">10pt</option>
                    <option value="11pt">11pt</option>
                    <option value="12pt">12pt</option>
                  </select>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={config.document.enableChinese}
                    onChange={(e) =>
                      updateConfig({
                        document: { ...config.document, enableChinese: e.target.checked },
                      })
                    }
                  />
                  启用中文支持
                </label>
              </div>

              <div className="settings-section">
                <h4>表格选项</h4>
                <label>
                  表格样式：
                  <select
                    value={config.table.tableStyle}
                    onChange={(e) =>
                      updateConfig({
                        table: { ...config.table, tableStyle: e.target.value as 'booktabs' | 'standard' },
                      })
                    }
                  >
                    <option value="booktabs">专业样式（booktabs）</option>
                    <option value="standard">标准样式</option>
                  </select>
                </label>

                <label>
                  自动换行阈值：
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={config.table.autoWrapThreshold}
                    onChange={(e) =>
                      updateConfig({
                        table: { ...config.table, autoWrapThreshold: parseInt(e.target.value) },
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MarkTexPanel;
