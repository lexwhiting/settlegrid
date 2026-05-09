/**
 * P5.4 — splice.ts unit tests.
 *
 * Spec checks:
 *   - both markers present, empty file → produces a one-import,
 *     one-entry result that compiles as TS
 *   - both markers present, prior entries → appends BEFORE END
 *     marker, leaving prior entries untouched
 *   - missing IMPORTS_END → throws (does NOT silently produce a
 *     half-spliced file)
 *   - missing ENTRIES_END → throws even when IMPORTS_END is present
 *     (this was the H9 hostile finding)
 *   - both markers missing → throws
 *   - special characters in template name (quotes, newlines,
 *     backslashes) escape correctly
 *   - the entry block is renderEntryBlock-stable across runs
 *     (snapshot for a known payload)
 */
import { describe, it, expect } from 'vitest'
import {
  ENTRIES_END,
  IMPORTS_END,
  type SplicePayload,
  escapeForTsString,
  insertBefore,
  renderEntryBlock,
  spliceRegisteredText,
} from '../splice'

const SCAFFOLD = `import type { BlogPost } from '../../blog-posts'

// TOTW_IMPORTS_BEGIN
// TOTW_IMPORTS_END

export const TOTW_POSTS: BlogPost[] = [
  // TOTW_ENTRIES_BEGIN
  // TOTW_ENTRIES_END
]
`

const STRIPE_PAYLOAD: SplicePayload = {
  importBinding: 'TOTW_2026_05_12_STRIPE_BODY',
  bodyFilename: '2026-05-12-stripe.md',
  postSlug: 'totw-2026-05-12-stripe',
  templateName: 'Stripe',
  templateSlug: 'stripe',
  date: '2026-05-12',
  wordCount: 412,
}

describe('insertBefore', () => {
  it('inserts payload immediately before the first match', () => {
    expect(insertBefore('foo MARKER bar', 'MARKER', '<X>')).toBe(
      'foo <X>MARKER bar',
    )
  })

  it('returns input unchanged when marker is missing', () => {
    expect(insertBefore('foo bar', 'MARKER', '<X>')).toBe('foo bar')
  })

  it('only inserts before the FIRST occurrence', () => {
    expect(insertBefore('a M b M c', 'M', '<X>')).toBe('a <X>M b M c')
  })
})

describe('escapeForTsString', () => {
  it('wraps a normal string in single quotes', () => {
    expect(escapeForTsString('hello world')).toBe("'hello world'")
  })

  it('escapes single quotes', () => {
    expect(escapeForTsString("it's fine")).toBe("'it\\'s fine'")
  })

  it('escapes backslashes before quote-escaping', () => {
    // Order matters: a string \\' must become \\\\\\' (4 backslashes
    // + escaped quote) so reading it back yields a literal `\'`.
    expect(escapeForTsString("a\\'b")).toBe("'a\\\\\\'b'")
  })

  it('escapes \\r and \\n', () => {
    expect(escapeForTsString('foo\nbar')).toBe("'foo\\nbar'")
    expect(escapeForTsString('foo\rbar')).toBe("'foo\\rbar'")
  })

  it('round-trip: the escaped output, when evaluated as a JS string literal, equals the input', () => {
    const cases = [
      'simple',
      "it's",
      'with \\backslash',
      'multi\nline',
      'CR\rLF',
      'a"b', // double quotes are unescaped (only single quotes are special inside single-quoted strings)
      "'edge' 'cases'",
    ]
    for (const input of cases) {
      const escaped = escapeForTsString(input)
      const evaluated = new Function(`return ${escaped}`)() as string
      expect(evaluated).toBe(input)
    }
  })
})

describe('renderEntryBlock', () => {
  it('produces a TS object literal block with the spec fields', () => {
    const block = renderEntryBlock(STRIPE_PAYLOAD)
    expect(block).toContain("slug: 'totw-2026-05-12-stripe'")
    expect(block).toContain("title: 'Stripe — Template of the Week'")
    expect(block).toContain('body: TOTW_2026_05_12_STRIPE_BODY')
    expect(block).toContain('published: false')
    expect(block).toContain('wordCount: 412')
    expect(block).toContain("datePublished: '2026-05-12'")
  })

  it('rounds reading-time up at 240 wpm', () => {
    expect(renderEntryBlock({ ...STRIPE_PAYLOAD, wordCount: 1 })).toContain(
      "readingTime: '1 min read'",
    )
    expect(renderEntryBlock({ ...STRIPE_PAYLOAD, wordCount: 240 })).toContain(
      "readingTime: '1 min read'",
    )
    expect(renderEntryBlock({ ...STRIPE_PAYLOAD, wordCount: 241 })).toContain(
      "readingTime: '2 min read'",
    )
    expect(renderEntryBlock({ ...STRIPE_PAYLOAD, wordCount: 1200 })).toContain(
      "readingTime: '5 min read'",
    )
  })

  it('escapes special characters in templateName so the output is valid TS', () => {
    const evil: SplicePayload = {
      ...STRIPE_PAYLOAD,
      templateName: "Stripe's \\nstrange\\name",
    }
    const block = renderEntryBlock(evil)
    // Each line in the block must be parseable as TS — verify by
    // checking the escaped name keyword line evaluates back to the
    // original.
    const titleMatch = block.match(/title: ('.+'),/)
    expect(titleMatch).not.toBeNull()
    if (titleMatch) {
      const evaluated = new Function(`return ${titleMatch[1]}`)() as string
      expect(evaluated).toBe("Stripe's \\nstrange\\name — Template of the Week")
    }
  })
})

describe('spliceRegisteredText', () => {
  it('inserts a one-import + one-entry result into the empty scaffold', () => {
    const next = spliceRegisteredText(SCAFFOLD, STRIPE_PAYLOAD)
    expect(next).toContain(
      "import TOTW_2026_05_12_STRIPE_BODY from './2026-05-12-stripe.md'",
    )
    expect(next).toContain("slug: 'totw-2026-05-12-stripe'")
    expect(next).toContain('// TOTW_IMPORTS_BEGIN')
    expect(next).toContain('// TOTW_IMPORTS_END')
    expect(next).toContain('// TOTW_ENTRIES_BEGIN')
    expect(next).toContain('// TOTW_ENTRIES_END')
  })

  it('places the new import BEFORE the IMPORTS_END marker', () => {
    const next = spliceRegisteredText(SCAFFOLD, STRIPE_PAYLOAD)
    const importIdx = next.indexOf('TOTW_2026_05_12_STRIPE_BODY')
    const markerIdx = next.indexOf(IMPORTS_END)
    expect(importIdx).toBeGreaterThan(0)
    expect(markerIdx).toBeGreaterThan(importIdx)
  })

  it('places the new entry BEFORE the ENTRIES_END marker', () => {
    const next = spliceRegisteredText(SCAFFOLD, STRIPE_PAYLOAD)
    const entryIdx = next.indexOf("slug: 'totw-2026-05-12-stripe'")
    const markerIdx = next.lastIndexOf(ENTRIES_END)
    expect(entryIdx).toBeGreaterThan(0)
    expect(markerIdx).toBeGreaterThan(entryIdx)
  })

  it('preserves prior entries when appending a second one', () => {
    // Run once — adds Stripe.
    const after1 = spliceRegisteredText(SCAFFOLD, STRIPE_PAYLOAD)
    // Run again with a different payload — must keep Stripe AND add
    // the new one.
    const githubPayload: SplicePayload = {
      ...STRIPE_PAYLOAD,
      importBinding: 'TOTW_2026_05_19_GITHUB_BODY',
      bodyFilename: '2026-05-19-github.md',
      postSlug: 'totw-2026-05-19-github',
      templateName: 'GitHub',
      templateSlug: 'github',
      date: '2026-05-19',
    }
    const after2 = spliceRegisteredText(after1, githubPayload)
    expect(after2).toContain('TOTW_2026_05_12_STRIPE_BODY')
    expect(after2).toContain('TOTW_2026_05_19_GITHUB_BODY')
    // Both entries' slugs should be present.
    expect(after2).toContain("slug: 'totw-2026-05-12-stripe'")
    expect(after2).toContain("slug: 'totw-2026-05-19-github'")
    // Markers still in place.
    expect(after2).toContain('// TOTW_IMPORTS_END')
    expect(after2).toContain('// TOTW_ENTRIES_END')
  })

  it('throws when IMPORTS_END marker is missing (operator removed it)', () => {
    const broken = SCAFFOLD.replace('// TOTW_IMPORTS_END\n', '')
    expect(() => spliceRegisteredText(broken, STRIPE_PAYLOAD)).toThrow(
      /TOTW_IMPORTS_END/,
    )
  })

  it('throws when ENTRIES_END marker is missing (H9 hostile finding)', () => {
    // Crucial: with IMPORTS_END present but ENTRIES_END missing, the
    // first insert succeeds and the second fails. The early bug
    // would have produced a half-spliced file with the import line
    // but no entry. Per-marker check catches it.
    const broken = SCAFFOLD.replace('// TOTW_ENTRIES_END\n', '')
    expect(() => spliceRegisteredText(broken, STRIPE_PAYLOAD)).toThrow(
      /TOTW_ENTRIES_END/,
    )
  })

  it('throws when both markers are missing', () => {
    const broken = SCAFFOLD.replace('// TOTW_IMPORTS_END\n', '').replace(
      '// TOTW_ENTRIES_END\n',
      '',
    )
    expect(() => spliceRegisteredText(broken, STRIPE_PAYLOAD)).toThrow()
  })

  it('does NOT modify a half-broken file (catch the half-splice)', () => {
    // Setup: IMPORTS_END is present but ENTRIES_END is missing.
    // After our throw, we should NOT have written a new import line
    // to the file (writes happen in the script wrapper, but the pure
    // function shouldn't even RETURN a partial result).
    const broken = SCAFFOLD.replace('// TOTW_ENTRIES_END\n', '')
    let threw = false
    try {
      spliceRegisteredText(broken, STRIPE_PAYLOAD)
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    // The function is pure; calling it again on the same input should
    // throw the same way (no internal mutation).
    expect(() => spliceRegisteredText(broken, STRIPE_PAYLOAD)).toThrow()
  })

  it('integration: splices the actual scaffolded registered.ts content shape', async () => {
    // Read the actual committed registered.ts and verify our splice
    // produces a result that contains all expected markers + the
    // new entry. This protects against the scaffold file drifting
    // away from a shape the splicer recognizes.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const registered = await fs.readFile(
      path.resolve(here, '..', '..', 'blog-bodies', 'totw', 'registered.ts'),
      'utf-8',
    )
    const next = spliceRegisteredText(registered, STRIPE_PAYLOAD)
    expect(next).toContain('TOTW_2026_05_12_STRIPE_BODY')
    expect(next).toContain('// TOTW_IMPORTS_BEGIN')
    expect(next).toContain('// TOTW_IMPORTS_END')
    expect(next).toContain('// TOTW_ENTRIES_BEGIN')
    expect(next).toContain('// TOTW_ENTRIES_END')
    expect(next.length).toBeGreaterThan(registered.length)
  })
})
