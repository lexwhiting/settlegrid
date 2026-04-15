import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 90_000,
    // index.test.ts smokes spawn node subprocesses. Running this package's
    // test files serially reduces concurrent subprocess load when turbo
    // runs multiple workspace test tasks at once, mitigating the knock-on
    // contention that caused apps/web's dynamic-import tests to hit their
    // default 5s timeout. Suite is small enough that the serialization cost
    // is negligible (~5s end-to-end).
    fileParallelism: false,
  },
})
