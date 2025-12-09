# Markdown to LaTeX 转换工具 📝

一个优雅的在线 Markdown 到 LaTeX 转换工具，特别强化了表格处理能力。

## ✨ 核心特性

### 🎯 智能表格处理（核心特色）
- **自动环境选择**：根据表格特征智能选择最优 LaTeX 环境（tabular、tabularx、longtable）
- **列宽自动计算**：基于内容长度智能分配列宽，确保排版美观
- **自动换行处理**：长文本单元格自动启用换行，避免溢出
- **专业样式**：支持 booktabs 专业表格样式

### 📝 完整 Markdown 支持
- 标题（H1-H6）
- 文本样式（粗体、斜体、删除线、行内代码）
- 列表（有序、无序、嵌套）
- 代码块（支持语法高亮配置）
- 链接和图片
- 引用块
- 数学公式（行内和块级）

### ⏡ 实时预览
- 300ms 防抖优化
- 即时查看 LaTeX 输出
- 支持长文档处理
- **双模式 PDF 编译**：优先使用前端 WebAssembly 编译，失败自动切换后端

### 🌐 PDF 生成（双模式）
- **前端编译（默认）**
  - 使用 WebAssembly 的 PDFTeX 引擎
  - 完全在浏览器中运行，无需后端服务
  - 快速、离线可用
  - 支持基本 LaTeX 语法（不支持中文）
- **后端编译（备用）**
  - 前端编译失败时自动切换
  - 使用 XeLaTeX 引擎，完整支持中文
  - 需要启动后端服务

### 📤 多种导出方式
- 下载 LaTeX 源码文件（.tex）
- 一键复制到剪贴板
- 完整文档结构（包含宏包声明）

### ⚙️ 灵活配置
- 文档类选择（article、report、book）
- 字体大小（10pt、11pt、12pt）
- 页面尺寸（A4、Letter、A5）
- 中文支持开关
- 表格样式偏好
- 自动换行阈值调整

### 🚀 快速开始

#### 前端应用（必需）

安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run dev
```

访问 http://localhost:5173

生产构建：

```bash
npm run build
```

构建产物在 `dist/` 目录下。

#### 后端服务（可选，用于中文 PDF 编译）

如果需要中文支持或复杂 LaTeX 功能，启动后端服务：

```bash
cd server
npm install
npm start
```

后端服务将运行在 http://localhost:3001

**注意**：后端编译需要系统安装 LaTeX 环境(MacTeX 或 TeX Live)

##### macOS 环境配置(首次使用)

1. **安装 Homebrew**(如未安装):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **配置 Homebrew 环境变量**(Apple Silicon Mac):
   ```bash
   echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
   eval "$(/opt/homebrew/bin/brew shellenv)"
   ```

3. **安装 BasicTeX**(轻量版，约 80MB):
   ```bash
   # 方式一：使用 Homebrew(推荐)
   brew install --cask basictex
   
   # 方式二：使用国内镜像(更快)
   curl -L -o /tmp/basictex.pkg https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/mac/mactex/mactex-basictex-20250308.pkg
   sudo installer -pkg /tmp/basictex.pkg -target /
   ```

4. **配置 LaTeX 环境变量**:
   ```bash
   echo 'eval "$(/usr/libexec/path_helper)"' >> ~/.zshrc
   eval "$(/usr/libexec/path_helper)"
   ```

5. **安装中文支持包**:
   ```bash
   # 配置清华镜像(加速)
   sudo tlmgr option repository https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/texlive/tlnet
   
   # 更新包管理器
   sudo tlmgr update --self
   
   # 安装中文支持
   sudo tlmgr install ctex xecjk
   ```

6. **验证安装**:
   ```bash
   xelatex --version
   ```

完成后重启后端服务即可使用中文 PDF 编译功能。

## 📖 使用说明

### 基本使用

1. **编辑 Markdown**：在左侧编辑器中输入或粘贴 Markdown 内容
2. **实时预览**：右侧自动显示生成的 LaTeX 代码
3. **导出**：点击"复制"或"下载"按钮获取 LaTeX 文件

### 表格处理示例

#### 简单表格

```
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A   | B   | C   |
| 1   | 2   | 3   |
```

自动生成为 `tabular` 环境。

#### 长文本表格

```
| 特性 | 详细说明 |
|------|----------|
| 智能处理 | 这是一段很长的文本，会自动触发换行处理，确保不会溢出页面边界 |
```

自动生成为 `tabularx` 环境，并计算合适的列宽。

### 配置选项

点击右上角"设置"按钮打开配置面板：

- **文档类**：根据文档类型选择（文章、报告、书籍）
- **字体大小**：选择合适的字体大小
- **中文支持**：自动检测中文并加载 ctex 宏包
- **表格样式**：专业样式（booktabs）或标准样式
- **自动换行阈值**：设置触发自动换行的字符数

## 🏗️ 技术架构

### 核心技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **编辑器**：CodeMirror 6
- **Markdown 解析**：markdown-it
- **状态管理**：Zustand

### 项目结构

```
src/
├── components/          # React 组件
│   ├── MarkdownEditor.tsx
│   ├── LatexPreview.tsx
│   ├── Toolbar.tsx
│   └── SettingsPanel.tsx
├── services/           # 核心服务
│   ├── latexRenderer.ts      # LaTeX 渲染器
│   ├── tableProcessor.ts     # 表格智能处理
│   ├── documentGenerator.ts  # 文档生成器
│   └── exportService.ts      # 导出服务
├── stores/            # 状态管理
│   └── appStore.ts
├── types/             # TypeScript 类型
│   └── index.ts
├── utils/             # 工具函数
│   └── latexEscape.ts
└── App.tsx            # 主应用
```

### 核心算法

#### 表格列宽计算

```
基于内容长度智能分配列宽
1. 计算每列最长内容的显示宽度（考虑中英文差异）
2. 按比例分配页面可用宽度
3. 应用最小/最大宽度约束
4. 转换为 LaTeX 宽度表达式
```

#### 表格环境选择决策树

```
行数 > 30              → longtable（支持跨页）
存在长文本 + 列数 ≤ 5  → tabularx（自动分配列宽）
全是短文本             → tabular（简单高效）
```

## 🎨 设计原则

1. **零依赖部署**：纯前端实现，无需服务器
2. **智能化**：自动检测和优化，减少用户配置
3. **性能优先**：防抖、懒加载优化用户体验
4. **专业输出**：生成符合 LaTeX 规范的高质量代码

## 📝 示例

### 输入（Markdown）

```
# 论文标题

## 摘要

这是一段**重要**的内容。

## 数据对比

| 方法 | 准确率 | 速度 |
|------|--------|------|
| 方法A | 95.2% | 快 |
| 方法B | 96.8% | 中等 |

数学公式：$E = mc^2$
```

### 输出（LaTeX）

```
\documentclass[11pt,a4paper]{article}
\usepackage{geometry}
\usepackage[UTF8]{ctex}
\usepackage{booktabs}

\geometry{
    left=2.5cm,
    right=2.5cm,
    top=2.5cm,
    bottom=2.5cm
}

\begin{document}

\section{论文标题}

\subsection{摘要}

这是一段\textbf{重要}的内容。

\subsection{数据对比}

\begin{tabular}{l c c}
\toprule
方法 & 准确率 & 速度 \\
\midrule
方法A & 95.2\% & 快 \\
方法B & 96.8\% & 中等 \\
\bottomrule
\end{tabular}

数学公式：$E = mc^2$

\end{document}
```

## 🔧 开发

### 代码规范

- TypeScript 严格模式
- ESLint + Prettier
- 组件化开发
- 功能模块解耦

### 添加新功能

1. 在 `services/` 目录添加服务逻辑
2. 在 `components/` 目录添加 UI 组件
3. 更新类型定义 `types/index.ts`
4. 集成到主应用 `App.tsx`

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系

如有问题或建议，请通过 GitHub Issues 联系。
