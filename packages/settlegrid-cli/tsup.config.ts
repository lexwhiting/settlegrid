import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/postinstall.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  minify: false,
  splitting: false,
  target: 'node20',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
