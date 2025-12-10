# 迁移指南 - 从双模式到纯前端化

本文档指导您从旧版本的双模式PDF编译架构迁移到新版本的纯前端SwiftLaTeX架构。

## 📋 变更概览

### 主要变化

1. **移除后端依赖**: 不再需要Node.js后端服务和系统LaTeX环境
2. **统一编译引擎**: 使用SwiftLaTeX XeTeX引擎替代双模式(PDFTeX + XeLaTeX)
3. **完整中文支持**: 前端引擎现在完整支持中文编译
4. **静态部署**: 可直接部署到GitHub Pages等静态托管平台

### 技术栈变化

| 组件 | 旧版本 | 新版本 |
|------|--------|--------|
| 前端编译 | texlive.js (PDFTeX) | SwiftLaTeX (XeTeX) |
| 后端编译 | node-latex + 系统XeLaTeX | ❌ 已移除 |
| 中文支持 | 仅后端支持 | ✅ 前端支持 |
| 部署方式 | 需要服务器 | 纯静态部署 |

## 🚀 迁移步骤

### 1. 更新依赖

```bash
# 拉取最新代码
git pull origin main

# 清理旧依赖
rm -rf node_modules package-lock.json

# 安装新依赖
npm install
```

### 2. 环境配置调整

**不再需要的配置:**
- ❌ 系统LaTeX环境(MacTeX/TeX Live)
- ❌ 后端服务器环境变量
- ❌ XeLaTeX中文字体包

**新增配置:**
- ✅ 确保浏览器支持WebAssembly (Chrome 90+, Firefox 88+)

### 3. 代码迁移

#### 如果您有自定义代码引用了旧的服务

**旧代码 (需要移除):**
```typescript
import { PdfCompileService } from './services/pdfCompileService';
import { frontendPdfService } from './services/frontendPdfService';
```

**新代码:**
```typescript
import { swiftlatexService } from './services/swiftlatexService';
```

#### API变化

**旧API:**
```typescript
// 前端编译
const pdfDataUrl = await frontendPdfService.compile(latexContent);

// 后端编译
const pdfBlob = await pdfCompileService.compileToPdf(latexContent);
```

**新API:**
```typescript
// 统一的SwiftLaTeX编译
const result = await swiftlatexService.compile(latexContent);
if (result.success && result.pdf) {
  const url = swiftlatexService.createPdfUrl(result.pdf);
}
```

### 4. 状态管理更新

新增状态字段用于引擎管理:

```typescript
// 新增状态
engineStatus: EngineStatus;          // 引擎状态
compilationStage: CompilationStage;  // 编译阶段
compilationProgress: number;         // 编译进度
fontLoadStatus: FontStatus;          // 字体加载状态
```

### 5. LaTeX文档配置变化

**旧配置 (ctex):**
```latex
\usepackage{ctex}
```

**新配置 (fontspec + xeCJK):**
```latex
\usepackage{fontspec}
\usepackage{xeCJK}
\setCJKmainfont{/fonts/NotoSansCJKsc-Regular.otf}
```

这个变化由系统自动处理,无需手动修改。

## 🎯 功能对比

### 保留功能

✅ 所有Markdown到LaTeX的转换功能
✅ 智能表格处理
✅ 数学公式支持
✅ 代码高亮
✅ LaTeX源码导出
✅ PDF生成和下载

### 改进功能

🎉 **中文支持**: 前端也可以编译中文PDF
🎉 **离线使用**: 首次加载后可离线工作
🎉 **部署简化**: 无需配置后端环境
🎉 **编译进度**: 显示详细的编译阶段和进度条

### 移除功能

❌ 后端编译备用方案(不再需要)
❌ 后端服务健康检查

## 🔧 开发环境迁移

### 旧的开发流程

```bash
# 启动前端
npm run dev

# 另一个终端启动后端
cd server
npm start
```

### 新的开发流程

```bash
# 只需启动前端
npm run dev
```

就这么简单!不再需要后端服务。

## 📦 部署迁移

### 旧部署方式

需要:
1. 前端静态资源部署
2. 后端Node.js服务器
3. 系统LaTeX环境配置

### 新部署方式

只需要:
1. 前端静态资源部署到任意平台

**支持的平台:**
- GitHub Pages (推荐,已配置自动部署)
- Vercel
- Netlify
- Cloudflare Pages
- 任意静态文件托管服务

## 🐛 常见问题

### Q: 首次编译很慢怎么办?

A: 首次编译需要下载SwiftLaTeX引擎(约15MB)和中文字体(约4MB)。下载完成后会自动缓存,后续编译会很快。

### Q: Safari浏览器编译失败?

A: Safari对WebAssembly的支持有限制。建议使用Chrome、Firefox或Edge浏览器。

### Q: 如何清除缓存重新加载?

A: 打开浏览器开发者工具,在Application标签页中清除Cache Storage和Service Workers。

### Q: 编译中文文档失败?

A: 确保:
1. 文档配置中启用了中文支持
2. 浏览器支持WebAssembly
3. 网络连接正常(首次加载字体)

### Q: 我还想使用后端编译怎么办?

A: 新版本已经移除了后端支持。SwiftLaTeX提供了与XeLaTeX一致的编译质量,建议迁移到纯前端方案。如果有特殊需求,可以保留旧版本代码。

## 📝 性能对比

| 指标 | 旧版本 | 新版本 |
|------|--------|--------|
| 首次加载 | ~2s | ~8s (包含引擎下载) |
| 二次访问 | ~2s | ~1s (缓存) |
| 中文编译 | 需后端 | ✅ 前端支持 |
| 离线使用 | ❌ | ✅ |
| 部署复杂度 | 高 | 低 |

## 🎓 最佳实践

1. **首次访问优化**: 在首页显示加载提示,告知用户正在下载编译引擎
2. **缓存管理**: 定期检查Service Worker缓存,确保使用最新版本
3. **错误处理**: 为用户提供清晰的错误提示和解决方案
4. **浏览器检测**: 检测浏览器版本,对不支持的浏览器显示友好提示

## 🔄 回滚方案

如果迁移遇到问题,可以临时回滚:

```bash
# 回滚到旧版本
git checkout <old-version-tag>

# 重新安装依赖
npm install

# 启动服务
npm run dev
cd server && npm start
```

## 📞 获取帮助

如遇到迁移问题:
1. 查看[完整文档](./README.md)
2. 检查[常见问题](#常见问题)
3. 提交[GitHub Issue](https://github.com/your-repo/issues)

---

**迁移完成检查清单:**

- [ ] 代码已更新到最新版本
- [ ] 依赖已重新安装
- [ ] 开发服务器正常运行
- [ ] PDF编译功能正常(英文和中文)
- [ ] 构建命令执行成功
- [ ] 部署配置已更新
- [ ] 旧的后端服务已停止

恭喜!您已成功迁移到纯前端化架构! 🎉
