import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
  base: '/',
  root: 'src',
  publicDir: 'public',
  plugins: [react()],
  build: {
    outDir: "build",
		copyPublicDir: true,
		emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'src/main.html',
        sidebar: 'src/sidebar.html'
      }
    }
  },
  define: {
    __dirname: JSON.stringify(path.dirname(fileURLToPath(import.meta.url))),
  },
})
