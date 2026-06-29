/**
 * COMPLETENESS tripwire for the JSON-LD / `<script>` injection class
 * (launch-gate G2-1). The governing failure mode here is an INCOMPLETE SWEEP:
 * a single un-migrated `<script type="application/ld+json">` sink that
 * `JSON.stringify`s untrusted tool / developer / review data without the `<`
 * escape is a stored XSS (CSP is `script-src 'unsafe-inline'`). One missed
 * sink defeats the whole hardening pass, so this guard reads EVERY source
 * file as text — every `.ts/.tsx/.js/.jsx/.mjs/.cjs/.mdx` under `src/` — and
 * fails if ANY raw sink survives — a future regression or an un-migrated sink
 * cannot ship green, including one authored in a non-TS file.
 *
 * Design notes (why whole-file, why this regex):
 *   - Reads each file with `readFileSync` and tests the WHOLE file string, so
 *     it catches multi-line JSX sinks (`__html:` and `JSON.stringify(` on
 *     separate lines, e.g. `app/layout.tsx`) that a line-by-line `git grep`
 *     would false-pass.
 *   - `/__html:\s*JSON\.stringify\(/` is the canonical raw-sink shape. The
 *     pre-build audit verified every `dangerouslySetInnerHTML` script sink in
 *     the tree serializes via `JSON.stringify` (none use a bespoke serializer),
 *     so this regex is false-positive-free for production sinks.
 *   - The only legitimate `JSON.stringify` inside a `__html:` context is the
 *     shared `safeJsonLd` helper itself (`lib/json-ld.ts`), which is excluded.
 *
 * Precedent: `honest-framing-regression.test.ts` / `shadow-index.test.ts`
 * do the same fs-based source assertions.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC_ROOT = resolve(__dirname, '..')

/** Paths (relative to src/) excluded from the scan: files that legitimately hold these patterns as data, not as live sinks. */
const ALLOWLIST = new Set<string>([
  'lib/json-ld.ts', // the shared safeJsonLd helper — JSON.stringify is its body
  '__tests__/json-ld-sink-guard.test.ts', // this guard itself — it names the patterns in its prose/titles
])

/**
 * Source extensions an ld+json `<script>` sink could legitimately live in. A
 * Next.js sink is normally `.tsx`, but `.ts/.js/.jsx/.mjs/.cjs` route handlers
 * and `.mdx` content can also emit a `dangerouslySetInnerHTML` ld+json script,
 * so the completeness walk must cover them all — a `.ts/.tsx`-only walk would
 * silently exempt a future sink in any other file type (DC-16 incomplete-sweep).
 */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mdx']

/** Recursively collect every source file under src/, as paths relative to src/. */
function collectSourceFiles(dir: string, relBase = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      out.push(...collectSourceFiles(resolve(dir, entry.name), rel))
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(rel)
    }
  }
  return out
}

const SOURCE_FILES = collectSourceFiles(SRC_ROOT)

// The raw-sink shape: `__html:` followed (possibly across newlines) by
// `JSON.stringify(`. Built from fragments so this guard file can never match
// itself.
const RAW_SINK = new RegExp('__html:' + '\\s*' + 'JSON\\.stringify\\(')

describe('json-ld sink completeness guard', () => {
  it('finds every source file (sanity: the walk covers the whole src tree)', () => {
    // The floor is set well above the sink-dense `app/` subtree (~548 of ~914
    // files). A regression that silently dropped `app/` from the walk would
    // leave ~366 files and still clear a loose `>100` floor — defeating the
    // very completeness this guard exists to enforce. 800 keeps headroom for
    // ordinary churn while still catching a whole-subtree drop.
    expect(SOURCE_FILES.length).toBeGreaterThan(800)
  })

  it('actually sees the ld+json sink files (catches a partial-subtree drop the total-file floor cannot)', () => {
    // The >800 total-file floor only catches dropping the WHOLE app/ subtree.
    // A glob/ignore regression that drops one sink-dense route group leaves
    // >800 files yet hides real sinks from the walk. ~45 files carry an ld+json
    // sink today; assert the walk still reaches a healthy floor of them. A drop
    // that removes only NON-sink files leaves this count intact and correctly
    // does not trip (no sink is missed).
    const LDJSON = /type=["']application\/ld\+json["']/
    let filesWithSink = 0
    for (const rel of SOURCE_FILES) {
      if (ALLOWLIST.has(rel)) continue
      if (LDJSON.test(readFileSync(resolve(SRC_ROOT, rel), 'utf8'))) filesWithSink++
    }
    expect(filesWithSink).toBeGreaterThan(30)
  })

  it('has NO raw `__html:`+`JSON.stringify(` sink — every ld+json script must go through safeJsonLd', () => {
    const offenders: string[] = []
    for (const rel of SOURCE_FILES) {
      if (ALLOWLIST.has(rel)) continue
      const src = readFileSync(resolve(SRC_ROOT, rel), 'utf8')
      if (RAW_SINK.test(src)) offenders.push(rel)
    }
    expect(offenders, `raw JSON-LD sinks must be migrated to safeJsonLd: ${offenders.join(', ')}`).toEqual([])
  })

  it('routes every `type="application/ld+json"` script through safeJsonLd (catches non-JSON.stringify serializers the regex above would miss)', () => {
    const LDJSON_ATTR = /type=["']application\/ld\+json["']/g
    const SAFE_CALL = /safeJsonLd\(/g
    const violations: { file: string; ldjson: number; safe: number }[] = []
    for (const rel of SOURCE_FILES) {
      if (ALLOWLIST.has(rel)) continue
      const src = readFileSync(resolve(SRC_ROOT, rel), 'utf8')
      const ldjson = (src.match(LDJSON_ATTR) ?? []).length
      if (ldjson === 0) continue
      const safe = (src.match(SAFE_CALL) ?? []).length
      if (safe < ldjson) violations.push({ file: rel, ldjson, safe })
    }
    expect(
      violations,
      `each ld+json script needs a safeJsonLd call: ${violations
        .map((v) => `${v.file} (${v.ldjson} scripts, ${v.safe} safeJsonLd)`)
        .join('; ')}`,
    ).toEqual([])
  })
})
