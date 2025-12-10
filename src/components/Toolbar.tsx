/**
 * 工具栏组件
 */

import { useAppStore } from '../stores/appStore';
import { ExportService } from '../services/exportService';
import { LatexRenderer } from '../services/latexRenderer';
import { DocumentGenerator } from '../services/documentGenerator';
import './Toolbar.css';

const exportService = new ExportService();
const docGenerator = new DocumentGenerator();

export function Toolbar() {
  const {
    latexOutput,
    markdownContent,
    config,
    setMarkdownContent,
    toggleSettingsPanel,
    showNotification,
  } = useAppStore();

  /**
   * 生成用于导出的 LaTeX 代码（Overleaf 兼容版）
   */
  const generateExportLatex = (): string => {
    try {
      const renderer = new LatexRenderer(config.table);
      const renderResult = renderer.render(markdownContent);
      // 传入 forExport: true 生成 Overleaf 兼容的字体配置
      return docGenerator.generate(renderResult, config.document, true);
    } catch (error) {
      console.error('Export generation error:', error);
      return latexOutput; // 降级使用预览版本
    }
  };

  const handleNew = () => {
    if (confirm('确定要新建文档吗？当前内容将被清空。')) {
      setMarkdownContent('# 新文档\n\n开始编辑...');
    }
  };

  const handleOpen = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        setMarkdownContent(text);
        showNotification('文件已打开', 'success');
      }
    };
    input.click();
  };

  const handleCopy = async () => {
    const exportLatex = generateExportLatex();
    const success = await exportService.copyToClipboard(exportLatex);
    if (success) {
      showNotification('已复制到剪贴板（Overleaf 兼容版）', 'success');
    } else {
      showNotification('复制失败', 'error');
    }
  };

  const handleDownload = () => {
    const exportLatex = generateExportLatex();
    exportService.downloadLatex(exportLatex);
    showNotification('文件已下载（Overleaf 兼容版）', 'success');
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <h1>📝 Markdown to LaTeX</h1>
        <a 
          href="https://github.com/Mappedinfo/MarkTex" 
          target="_blank" 
          rel="noopener noreferrer"
          className="github-link"
          title="GitHub 仓库"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          GitHub
        </a>
      </div>
      <div className="toolbar-center">
        <button onClick={handleNew} className="btn" title="新建">
          新建
        </button>
        <button onClick={handleOpen} className="btn" title="打开">
          打开
        </button>
      </div>
      <div className="toolbar-right">
        <button onClick={handleCopy} className="btn btn-primary" title="复制">
          复制
        </button>
        <button onClick={handleDownload} className="btn btn-primary" title="下载">
          下载
        </button>
        <button onClick={toggleSettingsPanel} className="btn" title="设置">
          设置
        </button>
      </div>
    </div>
  );
}
