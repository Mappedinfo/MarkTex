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
