import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Quan trọng cho Electron để load file tĩnh đúng đường dẫn
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // Tối ưu build
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        // Code splitting để giảm bundle size
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'lucide': ['lucide-react'],
        },
      },
    },
    // Tăng chunk size limit
    chunkSizeWarningLimit: 1000,
  },
  // Tối ưu dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
  },
});