/**
 * Markdown to LaTeX 后端服务器
 * 提供 LaTeX 编译为 PDF 的 API
 */

import express from 'express';
import cors from 'cors';
import latex from 'node-latex';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 支持大文件
app.use(express.text({ limit: '10mb', type: 'text/plain' }));

/**
 * 健康检查接口
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LaTeX compilation server is running' });
});

/**
 * LaTeX 编译接口
 * POST /api/compile
 * Body: { latex: string } - LaTeX 源码
 * Returns: PDF 文件流
 */
app.post('/api/compile', async (req, res) => {
  try {
    const { latex: latexContent } = req.body;

    if (!latexContent) {
      return res.status(400).json({ 
        error: 'Missing LaTeX content',
        message: '请提供 LaTeX 源码' 
      });
    }

    console.log('开始编译 LaTeX...');
    console.log('LaTeX 内容长度:', latexContent.length);

    // 编译选项
    // 注意：使用 passes > 1 时，必须传递字符串而不是流
    const options = {
      inputs: process.cwd(), // 输入文件路径
      cmd: 'xelatex', // 使用 xelatex 支持中文
      passes: 2, // 编译两次以生成目录和引用
    };

    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');

    // 创建 LaTeX 编译流（传递字符串而不是流）
    const pdf = latex(latexContent, options);

    // 处理编译错误
    pdf.on('error', (err) => {
      console.error('LaTeX 编译错误:', err);
      
      // 如果响应头还没发送，返回错误信息
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Compilation failed',
          message: '编译失败',
          details: err.message,
        });
      }
    });

    // 将 PDF 流传输到响应
    pdf.pipe(res);

    pdf.on('finish', () => {
      console.log('PDF 编译完成');
    });

  } catch (error) {
    console.error('服务器错误:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Server error',
        message: '服务器内部错误',
        details: error.message,
      });
    }
  }
});

/**
 * 测试编译接口
 * GET /api/test-compile
 * 使用简单的 LaTeX 文档测试编译功能
 */
app.get('/api/test-compile', async (req, res) => {
  const testLatex = `
\\documentclass{article}
\\usepackage{ctex}
\\begin{document}
\\section{测试}
这是一个测试文档。
\\end{document}
  `.trim();

  try {
    const options = {
      inputs: process.cwd(),
      cmd: 'xelatex',
      passes: 1,
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="test.pdf"');

    // 传递字符串而不是流
    const pdf = latex(testLatex, options);
    
    pdf.on('error', (err) => {
      console.error('测试编译错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    pdf.pipe(res);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 LaTeX 编译服务器运行在 http://localhost:${PORT}`);
  console.log(`   健康检查: http://localhost:${PORT}/api/health`);
  console.log(`   编译接口: POST http://localhost:${PORT}/api/compile`);
  console.log(`   测试编译: GET http://localhost:${PORT}/api/test-compile`);
});
