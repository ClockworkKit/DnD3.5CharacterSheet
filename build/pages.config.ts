import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.PAGES_BASE_PATH || '/DnD3.5CharacterSheet/';
if (!/^\/(?:[a-zA-Z0-9._-]+\/)*$/.test(base)) throw new Error('PAGES_BASE_PATH must be an absolute path ending in /.');

export default defineConfig({
  root: root + 'pages-client',
  base,
  publicDir: root + 'public',
  resolve: {alias: {'@': root}},
  define: {__BARROW_PAGES__: 'true', __BARROW_BASE__: JSON.stringify(base)},
  plugins: [react()],
  css: {postcss: root},
  build: {outDir: root + 'dist-pages', emptyOutDir: true},
});
