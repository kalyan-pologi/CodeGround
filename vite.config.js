import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  build: { rollupOptions: { input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    practice: fileURLToPath(new URL('./practice.html', import.meta.url))
  } } }
});
