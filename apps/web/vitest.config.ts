import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Inline markdown bodies under src/lib/blog-bodies + src/lib/academy-bodies
 * as raw string exports, mirroring the next.config.ts webpack asset/source
 * rule. Without this, any test that (transitively) imports blog-posts.ts
 * or academy-lessons.ts blows up in Vite's import-analysis pass because
 * the .md content isn't valid JS.
 *
 * The `id.startsWith(root)` narrowing is important: a random .md in
 * node_modules (e.g., a dependency's README imported for a rare reason)
 * shouldn't be turned into a raw-string export — only our own body
 * directories, which match the webpack rule's scoping.
 */
const MD_RAW_ROOTS = [
  path.resolve(__dirname, 'src/lib/blog-bodies'),
  path.resolve(__dirname, 'src/lib/academy-bodies'),
]

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    {
      name: 'md-as-raw-string',
      enforce: 'pre',
      // Vite's default loader already reads the file into `code`
      // as a UTF-8 string for unknown asset types, so we emit it
      // directly as a default export without a second fs read.
      transform(code, id) {
        if (!id.endsWith('.md')) return null
        if (!MD_RAW_ROOTS.some((root) => id.startsWith(root))) return null
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null,
        }
      },
    },
  ],
})
