/**
 * P2.MKT1 — unit tests for compare/nevermined/helpers.ts.
 *
 * The content-integrity test file (compare-nevermined.test.ts) reads
 * page.tsx as a string and asserts on substrings. That catches drift
 * but never exercises the actual helpers. These tests import gh() and
 * isSafeSourceUrl() directly and exercise every branch — including
 * the phishing/open-redirect defense from the hostile-review II
 * commit (8512817).
 */

import { describe, it, expect } from 'vitest'
import {
  gh,
  isSafeSourceUrl,
} from '../compare/nevermined/helpers'

describe('gh() — GitHub URL shaping', () => {
  it('emits /tree/main/ for directory paths (no file extension)', () => {
    expect(gh('apps/web/src/lib/settlement/adapters')).toBe(
      'https://github.com/lexwhiting/settlegrid/tree/main/apps/web/src/lib/settlement/adapters',
    )
  })

  it('emits /blob/main/ for .ts file paths', () => {
    expect(gh('apps/web/src/lib/settlement/sessions.ts')).toBe(
      'https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/sessions.ts',
    )
  })

  it.each([
    ['tsx', 'apps/web/src/app/page.tsx'],
    ['js', 'dist/index.js'],
    ['mjs', 'dist/worker.mjs'],
    ['cjs', 'dist/cjs/entry.cjs'],
    ['jsx', 'legacy/component.jsx'],
    ['md', 'README.md'],
    ['mdx', 'docs/guide.mdx'],
    ['json', 'package.json'],
    ['yml', '.github/workflows/ci.yml'],
    ['yaml', 'config.yaml'],
    ['toml', 'Cargo.toml'],
    ['svg', 'apps/web/public/icon.svg'],
    ['sh', 'scripts/deploy.sh'],
  ])('uses /blob/ for .%s extension', (_ext, path) => {
    expect(gh(path)).toContain('/blob/main/')
  })

  it('uses /tree/ for directories with dots in their name', () => {
    expect(gh('apps/web/src/app/api.v1')).toContain('/tree/main/')
  })

  it('strips leading slashes from the path argument', () => {
    expect(gh('/apps/web')).toBe(
      'https://github.com/lexwhiting/settlegrid/tree/main/apps/web',
    )
    expect(gh('///apps/web')).toBe(
      'https://github.com/lexwhiting/settlegrid/tree/main/apps/web',
    )
  })

  it('handles empty path (treated as repo root, directory kind)', () => {
    expect(gh('')).toBe('https://github.com/lexwhiting/settlegrid/tree/main/')
  })

  it('is case-insensitive on file extensions', () => {
    expect(gh('README.MD')).toContain('/blob/main/')
    expect(gh('Config.YAML')).toContain('/blob/main/')
  })

  it('does not confuse extensionless paths with dotted names', () => {
    // `.github` is a directory that starts with a dot but has no
    // file extension in the meaningful sense.
    expect(gh('.github')).toContain('/tree/main/')
  })

  it('always uses the `main` branch', () => {
    expect(gh('anything')).toContain('/main/')
  })

  it('always uses the SettleGrid canonical repo', () => {
    expect(gh('anything')).toContain('github.com/lexwhiting/settlegrid')
  })
})

describe('isSafeSourceUrl() — accepts valid inputs', () => {
  it('accepts internal absolute paths', () => {
    expect(isSafeSourceUrl('/pricing')).toBe(true)
    expect(isSafeSourceUrl('/register')).toBe(true)
    expect(isSafeSourceUrl('/a/b/c')).toBe(true)
  })

  it('accepts internal paths with query strings and fragments', () => {
    expect(isSafeSourceUrl('/docs?q=x')).toBe(true)
    expect(isSafeSourceUrl('/docs#section')).toBe(true)
  })

  it('accepts http URLs', () => {
    expect(isSafeSourceUrl('http://example.com')).toBe(true)
    expect(isSafeSourceUrl('http://example.com/path')).toBe(true)
  })

  it('accepts https URLs', () => {
    expect(isSafeSourceUrl('https://github.com/lexwhiting/settlegrid')).toBe(true)
    expect(isSafeSourceUrl('https://pypi.org/project/payments-py/')).toBe(true)
    expect(isSafeSourceUrl('https://nevermined.ai')).toBe(true)
  })
})

describe('isSafeSourceUrl() — rejects dangerous or malformed inputs', () => {
  it('rejects undefined', () => {
    expect(isSafeSourceUrl(undefined)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isSafeSourceUrl('')).toBe(false)
  })

  it('rejects protocol-relative URLs (//evil.com) — the phishing vector from hostile-review II', () => {
    expect(isSafeSourceUrl('//evil.com')).toBe(false)
    expect(isSafeSourceUrl('//nevermined.ai/blog')).toBe(false)
    expect(isSafeSourceUrl('///evil.com')).toBe(false)
  })

  it('rejects javascript: scheme (XSS)', () => {
    expect(isSafeSourceUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeSourceUrl('JavaScript:alert(1)')).toBe(false)
    expect(isSafeSourceUrl('  javascript:alert(1)')).toBe(false)
  })

  it('rejects data: scheme', () => {
    expect(isSafeSourceUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects file: scheme', () => {
    expect(isSafeSourceUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects vbscript: scheme', () => {
    expect(isSafeSourceUrl('vbscript:msgbox(1)')).toBe(false)
  })

  it('rejects mailto: scheme (we render email separately as plain text)', () => {
    expect(isSafeSourceUrl('mailto:support@settlegrid.ai')).toBe(false)
  })

  it('rejects ftp: scheme', () => {
    expect(isSafeSourceUrl('ftp://ftp.example.com/file')).toBe(false)
  })

  it('rejects malformed URLs (URL constructor throws)', () => {
    expect(isSafeSourceUrl('not a url at all')).toBe(false)
    expect(isSafeSourceUrl('http://')).toBe(false)
    expect(isSafeSourceUrl('https://[invalid')).toBe(false)
  })

  it('rejects relative paths without leading slash', () => {
    expect(isSafeSourceUrl('pricing')).toBe(false)
    expect(isSafeSourceUrl('./pricing')).toBe(false)
    expect(isSafeSourceUrl('../pricing')).toBe(false)
  })

  it('rejects non-string-like values even after type cast', () => {
    // Runtime robustness against unexpected inputs.
    expect(isSafeSourceUrl(null as unknown as string)).toBe(false)
  })
})

describe('isSafeSourceUrl() — type guard narrowing', () => {
  it('narrows the input to string on return true', () => {
    const maybe: string | undefined = '/pricing'
    if (isSafeSourceUrl(maybe)) {
      // TypeScript should accept this usage of maybe as string.
      const asString: string = maybe
      expect(asString).toBe('/pricing')
    } else {
      throw new Error('expected narrow to succeed')
    }
  })
})
