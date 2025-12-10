import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 开发服务器配置
  server: {
    proxy: {
      // 代理 SwiftLaTeX CDN 请求，解决 CORS 问题
      '/texlive': {
        target: 'https://texlive2.swiftlatex.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/texlive/, ''),
        secure: false,
      },
    },
  },
  
  // 构建优化
  build: {
    // 生成 sourcemap 以便调试
    sourcemap: false,
    
    // 代码分割策略
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 vendor 库分离
          'vendor': [
            'react',
            'react-dom',
            'zustand',
          ],
          // CodeMirror 编辑器单独分包
          'editor': [
            '@codemirror/commands',
            '@codemirror/lang-markdown',
            '@codemirror/state',
            '@codemirror/theme-one-dark',
            '@codemirror/view',
            '@lezer/highlight',
          ],
          // Markdown 解析器
          'markdown': [
            'markdown-it',
            'markdown-it-footnote',
            'markdown-it-task-lists',
          ],
        },
      },
    },
    
    // chunk 大小警告限制
    chunkSizeWarningLimit: 1000,
  },
  
  // GitHub Pages 部署配置
  base: './',
})
