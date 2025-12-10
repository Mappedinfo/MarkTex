#!/bin/bash

# SwiftLaTeX 格式文件生成脚本
# 用于生成 PdfTeX 的 pdflatex.fmt 格式文件

set -e

echo "🔧 开始生成 PdfTeX 格式文件..."

# 进入 pdftex.wasm 目录
cd "$(dirname "$0")/../public/swiftlatex/SwiftLaTeX-20022022/pdftex.wasm"

# 激活 emsdk 环境
echo "📦 激活 Emscripten 环境..."
source ../../../../emsdk/emsdk_env.sh

# 检查是否已编译
if [ ! -f "swiftlatexpdftex.js" ]; then
    echo "❌ 错误：swiftlatexpdftex.js 不存在，请先运行 make 编译引擎"
    exit 1
fi

# 创建一个简单的 Node.js 脚本来生成格式文件
echo "📝 创建格式文件生成脚本..."
cat > generate_format.cjs << 'EOF'
// 加载编译好的 PdfTeX 引擎
require('./swiftlatexpdftex.js');

// 等待 Module 初始化完成
Module.onRuntimeInitialized = async function() {
    console.log('✅ PdfTeX 引擎已加载');
    
    try {
        // 调用 compileFormat 函数生成格式文件
        console.log('🔧 开始生成格式文件...');
        const result = _compileFormat();
        
        if (result === 0) {
            console.log('✅ 格式文件生成成功！');
            
            // 读取生成的格式文件
            const formatPath = '/work/pdflatex.fmt';
            try {
                const formatData = FS.readFile(formatPath, { encoding: 'binary' });
                
                // 保存到当前目录
                const fs = require('fs');
                fs.writeFileSync('pdflatex.fmt', formatData);
                
                console.log('✅ 格式文件已保存到 pdflatex.fmt');
                console.log(`📊 文件大小: ${formatData.length} bytes`);
            } catch (err) {
                console.error('❌ 读取格式文件失败:', err);
                process.exit(1);
            }
        } else {
            console.error('❌ 格式文件生成失败，状态码:', result);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 生成过程出错:', error);
        process.exit(1);
    }
};

// 设置错误处理
Module.onAbort = function(what) {
    console.error('❌ 引擎崩溃:', what);
    process.exit(1);
};
EOF

# 运行生成脚本
echo "🚀 运行格式文件生成脚本..."
node generate_format.cjs

# 检查是否生成成功
if [ -f "pdflatex.fmt" ]; then
    echo ""
    echo "✅ 格式文件生成完成！"
    echo "📁 文件位置: $(pwd)/pdflatex.fmt"
    echo ""
    echo "📋 后续步骤："
    echo "1. 将 pdflatex.fmt 复制到项目的 public 目录"
    echo "2. 在应用启动时加载这个格式文件"
    echo ""
    
    # 清理临时文件
    rm generate_format.cjs
else
    echo "❌ 格式文件生成失败"
    rm generate_format.cjs
    exit 1
fi
