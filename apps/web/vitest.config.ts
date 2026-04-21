import { defineConfig } from 'vitest/config'
import path from 'path'
import { readFileSync } from 'node:fs'

/**
 * Inline markdown bodies under src/lib/blog-bodies + src/lib/academy-bodies
 * as raw string exports, mirroring the next.config.ts webpack asset/source
 * rule. Without this, any test that (transitively) imports blog-posts.ts
 * or academy-lessons.ts blows up in Vite's import-analysis pass because
 * the .md content isn't valid JS.
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
      transform(_code, id) {
        if (!id.endsWith('.md')) return null
        if (!MD_RAW_ROOTS.some((root) => id.startsWith(root))) return null
        // Read the raw markdown synchronously. Vite's transform hook
        // already has the file contents in `_code`, but we re-read to
        // match the webpack asset/source semantics verbatim: the
        // exported string is the exact on-disk bytes with no transform.
        const raw = readFileSync(id, 'utf-8')
        return {
          code: `export default ${JSON.stringify(raw)};`,
          map: null,
        }
      },
    },
  ],
})
