/**
 * 主应用组件
 */

import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { LatexRenderer } from './services/latexRenderer';
import { DocumentGenerator } from './services/documentGenerator';
import { Toolbar } from './components/Toolbar';
import { MarkdownEditor } from './components/MarkdownEditor';
import { LatexPreview } from './components/LatexPreview';
import { SettingsPanel } from './components/SettingsPanel';
import './App.css';

// 创建服务实例
let renderer: LatexRenderer | null = null;
const docGenerator = new DocumentGenerator();

function App() {
  const { markdownContent, config, setLatexOutput, notification, hideNotification } = useAppStore();

  // 初始化渲染器
  useEffect(() => {
    renderer = new LatexRenderer(config.table);
  }, []);

  // 实时转换（带防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (renderer) {
        try {
          // 更新表格配置
          renderer.updateTableConfig(config.table);
          
          // 渲染 Markdown 为 LaTeX
          const renderResult = renderer.render(markdownContent);
          
          // 生成完整文档
          const latexDoc = docGenerator.generate(renderResult, config.document);
          
          // 更新输出
          setLatexOutput(latexDoc);
        } catch (error) {
          console.error('Rendering error:', error);
        }
      }
    }, 300); // 300ms 防抖

    return () => clearTimeout(timer);
  }, [markdownContent, config]);

  return (
    <div className="app">
      <Toolbar />
      
      <div className="workspace">
        <MarkdownEditor />
        <div className="divider"></div>
        <LatexPreview />
      </div>

      <SettingsPanel />

      {notification.show && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default App;
