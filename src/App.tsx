/**
 * MarkTex 独立应用 - 使用 MarkTexPanel 作为核心组件
 * 独立部署时通过 GitHub Pages 访问
 */

import { MarkTexPanel } from './components/MarkTexPanel';
import './App.css';

const demoContent = `# MarkTex 编辑器

欢迎使用 **MarkTex** - 人类可读、机器可分析、可渲染为 LaTeX 的编辑器。

## Wiki-Link 语法

支持节点引用和关系类型标注：

- 节点引用：[[论文A|node-001]] 和 [[论文B|node-002]]
- 关系类型：[[引用]]、[[支持]]、[[反驳]]

### 三元组提取示例

[[论文A|node-001]] [[引用]] [[论文B|node-002]]

上面的句子会自动提取为知识图谱三元组：论文A -引用-> 论文B

## Markdown 功能

- **粗体** 和 *斜体* 文本
- \`行内代码\`
- [超链接](https://example.com)

### 表格

| 功能 | 状态 |
|------|------|
| Markdown 解析 | 完成 |
| LaTeX 渲染 | 完成 |
| Wiki-Link | 完成 |
| PDF 编译 | 可用 |

### 数学公式

行内公式 $E = mc^2$，块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$
`;

function App() {
  const handleWikiLinkClick = (type: 'node' | 'relation', id: string, label: string) => {
    console.log(`Wiki-link clicked: type=${type}, id=${id}, label=${label}`);
    alert(`${type === 'node' ? '节点' : '关系'}：${label}${id ? ` (${id})` : ''}`);
  };

  const handleNoteSave = async (note: { title: string; content: string }) => {
    console.log('Note saved:', note.title, note.content.length, 'chars');
    alert(`笔记已保存：${note.title || '无标题'}`);
  };

  return (
    <div className="app">
      <MarkTexPanel
        initialContent={demoContent}
        onWikiLinkClick={handleWikiLinkClick}
        onNoteSave={handleNoteSave}
        showPreview={true}
        showToolbar={true}
        showSettings={true}
        initialPreviewMode="preview"
      />
    </div>
  );
}

export default App;
