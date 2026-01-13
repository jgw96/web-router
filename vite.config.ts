import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'vitest.config.ts'],
    }),
    mode === 'analyze' && visualizer({
      filename: 'stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  build: {
    lib: {
      entry: {
        'web-router': resolve(__dirname, 'src/web-router.ts'),
        'plugins/lazy': resolve(__dirname, 'src/plugins/lazy.ts'),
      },
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
}));
