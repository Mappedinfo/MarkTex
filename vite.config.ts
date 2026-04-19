import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const isLibMode = process.env.BUILD_MODE === 'lib';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: isLibMode
    ? {
        // 库模式：输出可嵌入的 ES 模块，外部化 React
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'MarkTex',
          formats: ['es'],
          fileName: (format) => `marktex.${format}.js`,
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
          },
        },
        outDir: 'dist-lib',
        sourcemap: true,
        chunkSizeWarningLimit: 1000,
      }
    : {
        // 应用模式：独立部署（GitHub Pages），打包所有依赖
        outDir: 'dist',
        rollupOptions: {
          output: {
            manualChunks: undefined,
          },
        },
        sourcemap: false,
        chunkSizeWarningLimit: 1000,
      },

  // 开发服务器配置
  server: {
    proxy: {
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
