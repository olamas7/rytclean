import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';

export default defineConfig({
  plugins: [react(), jsconfigPaths()],
  base: '/',
  define: {
    global: 'window'
  },
  server: {
    open: true,
    host: '0.0.0.0',
    port: 8101,
    proxy: {
      '/api': {
        target: 'http://localhost:3101',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  preview: {
    open: true,
    port: 8101
  }
});
