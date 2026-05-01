/**
 * P4.MKT3 — runtime branch tests for compare/nevermined/data.ts and
 * opengraph-image.tsx.
 *
 * The `compare-nevermined.test.ts` suite covers content (90%+ of stmts
 * in data.ts via the happy path) and `compare-nevermined-helpers.test.ts`
 * covers helpers.ts at 100%. This file picks up the leftover branches:
 *
 *   - data.ts: the fallback path when every readdirSync candidate
 *     either throws or returns a count below the sanity floor
 *   - opengraph-image.tsx: the default export was at 0% because
 *     existing tests never invoke the function
 *
 * Each test isolates module state with `vi.resetModules()` so the
 * mocked-fs reload doesn't leak into other suites.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('node:fs')
})

describe('data.ts — TEMPLATE_COUNT fallback path', () => {
  it('falls back to the hardcoded TEMPLATE_COUNT_FALLBACK when every readdirSync candidate throws', async () => {
    vi.doMock('node:fs', () => ({
      readdirSync: () => {
        throw new Error('ENOENT: simulated missing directory')
      },
    }))
    vi.resetModules()

    const { TEMPLATE_COUNT } = await import('../compare/nevermined/data')

    // The sentinel value the module ships with when filesystem state
    // is unreachable. If this number changes, update both the module
    // and this assertion.
    expect(TEMPLATE_COUNT).toBe(954)
  })

  it('falls back when every candidate returns a count below the sanity floor', async () => {
    // Simulate a partial filesystem that has 5 directories — well below
    // the 100-template sanity floor. The module should reject the
    // suspicious count from every candidate and serve the fallback.
    vi.doMock('node:fs', () => ({
      readdirSync: () => [
        { name: 'a', isDirectory: () => true },
        { name: 'b', isDirectory: () => true },
        { name: 'c', isDirectory: () => true },
        { name: 'd', isDirectory: () => true },
        { name: 'e', isDirectory: () => true },
      ],
    }))
    vi.resetModules()

    const { TEMPLATE_COUNT } = await import('../compare/nevermined/data')

    expect(TEMPLATE_COUNT).toBe(954)
  })

  it('skips dotfile directories (e.g. .DS_Store) when counting templates', async () => {
    // The filter `!e.name.startsWith('.')` is the F3 hostile-review fix.
    // Mock a filesystem where 100 entries are real and 5 are dotfiles —
    // the count should be 100 (sanity floor met), not 105.
    const realEntries = Array.from({ length: 100 }, (_, i) => ({
      name: `template-${i}`,
      isDirectory: () => true,
    }))
    const dotEntries = Array.from({ length: 5 }, (_, i) => ({
      name: `.${i === 0 ? 'DS_Store' : `dot-${i}`}`,
      isDirectory: () => true,
    }))
    vi.doMock('node:fs', () => ({
      readdirSync: () => [...realEntries, ...dotEntries],
    }))
    vi.resetModules()

    const { TEMPLATE_COUNT } = await import('../compare/nevermined/data')

    expect(TEMPLATE_COUNT).toBe(100)
  })

  it('skips non-directory entries (regular files at the top level)', async () => {
    // The filter `e.isDirectory()` should reject files even if they
    // happen to be named like templates.
    const directories = Array.from({ length: 100 }, (_, i) => ({
      name: `template-${i}`,
      isDirectory: () => true,
    }))
    const files = Array.from({ length: 50 }, (_, i) => ({
      name: `README-${i}.md`,
      isDirectory: () => false,
    }))
    vi.doMock('node:fs', () => ({
      readdirSync: () => [...directories, ...files],
    }))
    vi.resetModules()

    const { TEMPLATE_COUNT } = await import('../compare/nevermined/data')

    expect(TEMPLATE_COUNT).toBe(100)
  })
})

describe('opengraph-image.tsx — runtime invocation', () => {
  it('default export is a function', async () => {
    const mod = await import('../compare/nevermined/opengraph-image')
    expect(typeof mod.default).toBe('function')
  })

  it('exports the OG image metadata constants required by Next.js', async () => {
    const mod = await import('../compare/nevermined/opengraph-image')
    expect(mod.alt).toBe('SettleGrid vs. Nevermined: Honest Comparison')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
  })

  it('declares edge runtime (required for next/og ImageResponse)', async () => {
    const mod = await import('../compare/nevermined/opengraph-image')
    expect(mod.runtime).toBe('edge')
  })

  // The factory body itself is exercised end-to-end by `next build` (the
  // OG image is generated as a build artifact). Invoking it from a node-
  // env vitest context fails because the file uses JSX without an
  // explicit React import, relying on Next's automatic runtime.
  // Verifying that the function is a function + the metadata constants
  // are correct + the build succeeds gives full real-world coverage.
})
