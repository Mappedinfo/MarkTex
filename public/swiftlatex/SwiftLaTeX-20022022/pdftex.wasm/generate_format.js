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
