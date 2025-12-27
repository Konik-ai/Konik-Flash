import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/agnosupdate': {
        target: 'https://storage.konik.ai',
        changeOrigin: true,
      },
      '/qdl': {
        target: 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/qdl/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Inline @commaai/qdl to fix ESM resolution issues (missing .js extensions in imports)
    deps: {
      inline: ['@commaai/qdl'],
    },
  },
})
