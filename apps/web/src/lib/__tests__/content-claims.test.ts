import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Content-accuracy guard.
 *
 * LLM-generated marketing/guide content has repeatedly placed FABRICATED
 * product claims on the live site — CLI commands that don't exist
 * (`npx settlegrid publish/doctor/sandbox/badge/scaffold`), scaffolder
 * flags that don't exist (`--category`/`--pricing`/`--list`), a
 * non-existent SDK config file (`settlegrid.config.ts`), and fake SDK
 * exports/test-utils (`withBilling` as an export, `createTestClient`,
 * `expectBillingEvent`). Each round was fixed by hand. This test makes the
 * whole class fail in CI instead of shipping to production.
 *
 * Design is a hybrid (see PR discussion):
 *   - STRUCTURAL: extract every `npx settlegrid <cmd>` /
 *     `npx @settlegrid/cli <cmd>` and every `create-settlegrid-tool --<flag>`
 *     from content and cross-check against the REAL command / flag lists.
 *     This catches FUTURE invented commands/flags for free — not just the
 *     ones we've already seen.
 *   - DENYLIST: a short list of tokens that have no legitimate form in
 *     site content at all.
 *
 * Sources of truth (keep these lists in sync if the real CLI grows):
 *   - CLI commands: packages/settlegrid-cli/src/commands/ + index.ts
 *     register exactly one command today: `add`.
 *   - Scaffolder flags: packages/create-settlegrid-tool/src/args.ts parses
 *     only `--template`, `--help`/`-h`, `--version`.
 *   - SDK public surface: packages/mcp/src/index.ts barrel — the real API
 *     is `settlegrid.init()` / `sg.wrap()` / `settlegridMiddleware`. There
 *     is no `withBilling` export (that name is only a LOCAL variable some
 *     examples assign from `settlegridMiddleware()` — which is why the SDK
 *     import check below is import-context-scoped, to avoid flagging the
 *     legitimate `const withBilling = settlegridMiddleware(...)`).
 *
 * Scope: apps/web/src only (the live, user-facing site). Internal docs
 * under docs/ are drafts and are intentionally out of scope.
 */

const SRC_ROOT = path.resolve(__dirname, '../..') // → apps/web/src

/** Real CLI commands. See packages/settlegrid-cli/src/commands/. */
const REAL_CLI_COMMANDS = new Set(['add'])

/** Real `create-settlegrid-tool` flags. See create-settlegrid-tool/src/args.ts. */
const REAL_SCAFFOLD_FLAGS = new Set(['--template', '--help', '--version'])

/** Tokens with no legitimate form anywhere in site content. */
const DENY_TOKENS = [
  'settlegrid.config.ts', // no SDK config file — pricing is inline in settlegrid.init()
  'createTestClient', // not an SDK export
  'expectBillingEvent', // not an SDK export
  'SETTLEGRID_TOOL_ID', // fabricated env var — tools are identified by toolSlug
]

// ── File collection ─────────────────────────────────────────────────────────

const CONTENT_EXTS = new Set(['.ts', '.tsx', '.md'])

/** Recursively collect content files, excluding tests + type decls. */
function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    // Skip test directories — this file lists the bad tokens as literals
    // and would otherwise flag itself.
    if (entry === '__tests__' || entry === 'node_modules') continue
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, acc)
      continue
    }
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue
    if (entry.endsWith('.d.ts')) continue
    if (CONTENT_EXTS.has(path.extname(entry))) acc.push(full)
  }
  return acc
}

const FILES: { rel: string; text: string }[] = collectFiles(SRC_ROOT).map(
  (full) => ({
    rel: path.relative(SRC_ROOT, full),
    text: readFileSync(full, 'utf-8'),
  }),
)

// ── Structural checks ───────────────────────────────────────────────────────

describe('content accuracy: CLI commands', () => {
  it('every `npx settlegrid <cmd>` / `npx @settlegrid/cli <cmd>` is a real command', () => {
    // Capture the command word only (must start with a letter, so flags
    // like `--version` are naturally excluded and stay valid).
    const re = /\bnpx (?:@settlegrid\/cli|settlegrid)\s+([a-z][\w-]*)/g
    const violations: string[] = []
    for (const { rel, text } of FILES) {
      for (const m of text.matchAll(re)) {
        if (!REAL_CLI_COMMANDS.has(m[1])) {
          violations.push(`${rel}: "npx settlegrid ${m[1]}" — not a real command`)
        }
      }
    }
    expect(
      violations,
      `Fabricated CLI command(s) found. Real commands: ${[...REAL_CLI_COMMANDS].join(', ')}.\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

describe('content accuracy: scaffolder flags', () => {
  it('every `create-settlegrid-tool --<flag>` is a real flag', () => {
    const cmdRe = /\bcreate-settlegrid-tool\b([^\n`]*)/g
    const flagRe = /--[a-z][a-z-]*/g
    const violations: string[] = []
    for (const { rel, text } of FILES) {
      for (const m of text.matchAll(cmdRe)) {
        for (const f of m[1].matchAll(flagRe)) {
          if (!REAL_SCAFFOLD_FLAGS.has(f[0])) {
            violations.push(`${rel}: "create-settlegrid-tool ${f[0]}" — not a real flag`)
          }
        }
      }
    }
    expect(
      violations,
      `Fabricated scaffolder flag(s) found. Real flags: ${[...REAL_SCAFFOLD_FLAGS].join(', ')}.\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── Denylist checks ─────────────────────────────────────────────────────────

describe('content accuracy: denylisted tokens', () => {
  it('no fabricated config-file / SDK-test-util / env-var tokens', () => {
    const violations: string[] = []
    for (const { rel, text } of FILES) {
      for (const token of DENY_TOKENS) {
        if (text.includes(token)) {
          violations.push(`${rel}: contains "${token}"`)
        }
      }
    }
    expect(
      violations,
      `Denylisted token(s) found:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('no fabricated SDK imports from @settlegrid/*', () => {
    // Import-context only: flags `import { withBilling } from '@settlegrid/...'`
    // but NOT the legitimate `const withBilling = settlegridMiddleware(...)`.
    const re =
      /import[^;\n]*\b(withBilling|createTestClient|expectBillingEvent)\b[^;\n]*from\s*['"]@settlegrid/g
    const violations: string[] = []
    for (const { rel, text } of FILES) {
      for (const m of text.matchAll(re)) {
        violations.push(`${rel}: imports "${m[1]}" from @settlegrid/* (not a real export)`)
      }
    }
    expect(
      violations,
      `Fabricated SDK import(s) found:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── Self-check: the guard is actually scanning content ───────────────────────

describe('content accuracy: guard sanity', () => {
  it('scans a non-trivial number of content files', () => {
    // If file collection silently breaks (wrong root, bad exclude), the
    // structural checks would vacuously pass. Pin a floor so the guard
    // can't rot into a no-op.
    expect(FILES.length).toBeGreaterThan(50)
  })

  it('actually reaches the known guide registries', () => {
    const rels = FILES.map((f) => f.rel)
    expect(rels).toContain('lib/howto-guides.ts')
    expect(rels).toContain('lib/blog-posts.ts')
  })
})
