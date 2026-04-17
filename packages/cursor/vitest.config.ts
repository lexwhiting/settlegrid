import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    // cli.ts is a standalone MCP stdio server that calls main() at
    // module load — vitest must not import it as a test file.
    exclude: ['src/cli.ts'],
  },
})
