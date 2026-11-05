import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/Java-Practice/' : '/',
  esbuild: { jsx: 'automatic' },
}));
