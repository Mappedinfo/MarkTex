# SwiftLaTeX WASM 文件说明

## 问题

当 MarkTex 作为子模块集成到其他项目时，PDF 导出功能需要预编译的 SwiftLaTeX WebAssembly 文件。这些文件体积较大（~3-5MB），不适合提交到 Git 仓库。

## 解决方案

### 方案一：从 Release 下载（推荐）

1. 下载 SwiftLaTeX v15022022 release：
   ```bash
   curl -L -o swiftlatex.zip "https://github.com/SwiftLaTeX/SwiftLaTeX/files/8066082/15022022.zip"
   unzip -o swiftlatex.zip -d swiftlatex-release
   ```

2. 将 WASM 文件复制到项目 public 目录：
   ```bash
   cp swiftlatex-release/swiftlatexpdftex.wasm <your-project>/public/swiftlatex/SwiftLaTeX-20022022/pdftex.wasm/
   cp swiftlatex-release/swiftlatexdvipdfm.wasm <your-project>/public/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm/
   cp swiftlatex-release/swiftlatexxetex.wasm <your-project>/public/swiftlatex/SwiftLaTeX-20022022/xetex.wasm/
   ```

3. 复制引擎 JS 文件：
   ```bash
   cp swiftlatex-release/PdfTeXEngine.js <your-project>/public/swiftlatex/SwiftLaTeX-20022022/pdftex.wasm/
   cp swiftlatex-release/DvipdfmxEngine.js <your-project>/public/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm/
   cp swiftlatex-release/XeTeXEngine.js <your-project>/public/swiftlatex/SwiftLaTeX-20022022/xetex.wasm/
   ```

### 方案二：自己编译（需要 Emscripten）

如果需要最新版本或自定义构建：

1. 安装 Emscripten SDK：
   ```bash
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. 编译引擎：
   ```bash
   # XeTeX 引擎（推荐，支持中文和 OpenType 字体）
   cd public/swiftlatex/SwiftLaTeX-20022022/xetex.wasm
   make

   # PdfTeX 引擎（仅英文，更轻量）
   cd public/swiftlatex/SwiftLaTeX-20022022/pdftex.wasm
   make

   # Dvipdfmx 引擎（XDV 转 PDF）
   cd public/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm
   make
   ```

## 完整文件结构

集成后，`public/swiftlatex/` 目录应包含：

```
public/swiftlatex/
├── SwiftLaTeX-20022022/
│   ├── pdftex.wasm/
│   │   ├── PdfTeXEngine.js          # 引擎加载器
│   │   └── swiftlatexpdftex.wasm    # 编译后的 WASM 文件 (~1.8MB)
│   ├── dvipdfm.wasm/
│   │   ├── DvipdfmxEngine.js        # 引擎加载器
│   │   └── swiftlatexdvipdfm.wasm   # 编译后的 WASM 文件 (~700KB)
│   └── xetex.wasm/
│       ├── XeTeXEngine.js           # 引擎加载器
│       └── swiftlatexxetex.wasm     # 编译后的 WASM 文件 (~3MB)
└── (其他文件)
```

## 验证安装

启动开发服务器后，检查以下 URL 返回 200 状态码：

- `http://localhost:5173/swiftlatex/SwiftLaTeX-20022022/pdftex.wasm/swiftlatexpdftex.wasm`
- `http://localhost:5173/swiftlatex/SwiftLaTeX-20022022/dvipdfm.wasm/swiftlatexdvipdfm.wasm`
- `http://localhost:5173/swiftlatex/SwiftLaTeX-20022022/xetex.wasm/swiftlatexxetex.wasm`

## 故障排除

### 404 错误
确保 WASM 文件已正确复制到 `public/swiftlatex/` 目录，并且 Vite 开发服务器已重启。

### XeTeX 引擎加载失败
控制台显示 "XeTeX 引擎加载失败"，但 WASM 文件存在。检查浏览器控制台是否有其他错误信息，可能需要检查网络请求或 CORS 配置。

### DvipdfmxEngine 加载失败警告
这是正常的警告，Dvipdfmx 用于将 XeTeX 的 XDV 输出转换为 PDF。如果只需要预览功能，可以忽略此警告。

## 相关链接

- [SwiftLaTeX GitHub](https://github.com/SwiftLaTeX/SwiftLaTeX)
- [SwiftLaTeX 官网](https://www.swiftlatex.com)
- [Emscripten 文档](https://emscripten.org/docs/getting_started/downloads.html)
