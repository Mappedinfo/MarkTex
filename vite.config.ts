import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // 库模式构建配置
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MarkTex',
      formats: ['es', 'umd'],
      fileName: (format) => `marktex.${format}.js`,
    },
    rollupOptions: {
      // 确保外部依赖不被包含在库中
      external: [
        'react',
        'react-dom',
        'zustand',
        '@codemirror/commands',
        '@codemirror/lang-markdown',
        '@codemirror/state',
        '@codemirror/theme-one-dark',
        '@codemirror/view',
        '@lezer/highlight',
        'markdown-it',
        'markdown-it-footnote',
        'markdown-it-task-lists',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          zustand: 'zustand',
        },
      },
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },

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

  // GitHub Pages 部署配置
  base: './',
})
