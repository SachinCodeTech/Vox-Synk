import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/ws-sync': {
        target: 'ws://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
  }
});
