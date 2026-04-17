import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  // `@settlegrid/mcp` and `@mastra/core` are peer deps — never bundled.
  external: ['@settlegrid/mcp', '@mastra/core'],
})
