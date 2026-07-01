import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'recharts': ['recharts'],
          'lucide': ['lucide-react']
        }
      }
    }
  },
  preview: {
    port: 4173,
    host: '0.0.0.0'
  }
})
