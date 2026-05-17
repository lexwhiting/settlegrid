import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/postinstall.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: false,
  minify: false,
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
