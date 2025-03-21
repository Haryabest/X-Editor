import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  assetsInclude: ['**/*.worker.js'], // Указываем, что файлы воркеров — это активы
  optimizeDeps: {
    include: ['monaco-editor'],
  },
  resolve: {
    alias: {
      path: 'path-browserify',

      // Убедитесь, что пути к Monaco корректны
      'monaco-editor': resolve(__dirname, 'node_modules/monaco-editor'),
    },
  },
});