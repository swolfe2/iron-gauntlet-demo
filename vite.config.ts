import { defineConfig } from 'vite';

export default defineConfig({
  base: '/iron-gauntlet-demo/',
  build: {
    outDir: 'docs',
    assetsDir: 'assets',
  }
});
