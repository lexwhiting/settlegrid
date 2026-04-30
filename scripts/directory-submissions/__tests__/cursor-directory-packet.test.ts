/**
 * Integrity tests for the cursor.directory submission packet (P3.13).
 *
 * These pin down the hostile-review findings from P3.13 R3:
 * fabricated trigger heuristics, broken file-path references, MDC
 * frontmatter drifting away from Cursor's canonical keys, internal
 * contradictions about screenshot necessity, and glob negation
 * patterns that Cursor's MDC parser may silently ignore.
 *
 * The packet is documentation, not executable code, so the relevant
 * regression surface is "does this still describe reality" — these
 * assertions encode the parts of "reality" that drifted in earlier
 * R3 passes.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKET_DIR = resolve(__dirname, '..', 'packets', 'cursor.directory')
const REPO_ROOT = resolve(PACKET_DIR, '..', '..', '..', '..')

function packetFile(name: string): string {
  return resolve(PACKET_DIR, name)
}

function readPacket(name: string): string {
  return readFileSync(packetFile(name), 'utf8')
}

// ─── 1. all four required artifacts ────────────────────────────────────────

describe('cursor.directory packet — required artifacts', () => {
  it.each(['submission.md', 'mdc-rule.md', 'screenshot.png', 'README.md'])(
    'has %s',
    (name) => {
      expect(existsSync(packetFile(name))).toBe(true)
    },
  )

  it('screenshot.png is a real PNG (placeholder is fine; format must validate)', () => {
    // Hostile-review pin: a future "fix" might replace the placeholder
    // with a 0-byte file or a different file format. cursor.directory's
    // crawler doesn't currently consume the screenshot, but a
    // marketing-time screenshot still needs to be a valid PNG. PNG
    // magic bytes: 89 50 4E 47 0D 0A 1A 0A.
    const buf = readFileSync(packetFile('screenshot.png'))
    expect(buf.length).toBeGreaterThan(0)
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50) // P
    expect(buf[2]).toBe(0x4e) // N
    expect(buf[3]).toBe(0x47) // G
    expect(buf[4]).toBe(0x0d)
    expect(buf[5]).toBe(0x0a)
    expect(buf[6]).toBe(0x1a)
    expect(buf[7]).toBe(0x0a)
  })
})

// ─── 2. MDC frontmatter is Cursor-canonical only ───────────────────────────

function parseFrontmatter(source: string): {
  raw: string
  keys: string[]
  body: string
} {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error('mdc-rule.md missing YAML frontmatter')
  const [, raw, body] = match
  // Top-level keys only — sub-keys (list items, nested maps) start with
  // whitespace. Frontmatter keys land at column zero.
  const keys = raw
    .split('\n')
    .filter((line) => /^[a-zA-Z]/.test(line))
    .map((line) => line.split(':')[0].trim())
  return { raw, keys, body }
}

describe('mdc-rule.md frontmatter — Cursor-canonical keys only', () => {
  // Hostile-review pin (HF2 from P3.13 R3 first pass): the rule
  // originally carried name/slug/author/source/homepage/tags in
  // frontmatter. Cursor's MDC parser only consumes
  // description / globs / alwaysApply. Submission metadata must live
  // in submission.md, not in the rule's frontmatter.
  const ALLOWED_KEYS = new Set(['description', 'globs', 'alwaysApply'])

  it('contains the required `description` key', () => {
    const { keys } = parseFrontmatter(readPacket('mdc-rule.md'))
    expect(keys).toContain('description')
  })

  it('contains no keys outside Cursor MDC canonical set', () => {
    const { keys } = parseFrontmatter(readPacket('mdc-rule.md'))
    const extras = keys.filter((k) => !ALLOWED_KEYS.has(k))
    expect(extras).toEqual([])
  })

  it('description references the specific MCP-server triggers, not vague marketing', () => {
    // Hostile-review pin: "generic developer marketing copy" is the
    // failure mode cursor.directory maintainers reject. The
    // description must name at least one concrete trigger
    // (modelcontextprotocol/sdk OR fastmcp OR a real MCP function call).
    const { raw } = parseFrontmatter(readPacket('mdc-rule.md'))
    const descLine = raw.split('\n').find((l) => l.startsWith('description:')) ?? ''
    expect(descLine).toMatch(/@modelcontextprotocol\/sdk|fastmcp|server\.tool|setRequestHandler/)
  })
})

// ─── 3. globs don't use negation (HF6 regression) ──────────────────────────

describe('mdc-rule.md globs — no negation patterns', () => {
  // Hostile-review pin (HF6): Cursor's documented MDC parser doesn't
  // specify negation support. ``!**/node_modules/**`` etc. may be
  // silently dropped, at which point the rule attempts to fire on
  // every TS/JS file under node_modules. Cursor's built-in
  // ignored-paths list already excludes those directories — keep the
  // glob array positive-only so the parser semantics are unambiguous.
  it('no glob entry begins with `!` (negation)', () => {
    const { raw } = parseFrontmatter(readPacket('mdc-rule.md'))
    // Capture the glob list block (lines indented under `globs:`).
    const globsMatch = raw.match(/globs:\s*\n((?:\s+- .+\n?)+)/)
    const globsBlock = globsMatch?.[1] ?? ''
    const negations = globsBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- ') && l.includes('"!'))
    expect(negations).toEqual([])
  })
})

// ─── 4. trigger heuristics are grounded, not fabricated (HF7) ──────────────

describe('mdc-rule.md trigger heuristics — grounded in real MCP patterns', () => {
  it('mentions @modelcontextprotocol/sdk', () => {
    expect(readPacket('mdc-rule.md')).toMatch(/@modelcontextprotocol\/sdk/)
  })
  it('mentions fastmcp', () => {
    expect(readPacket('mdc-rule.md')).toMatch(/fastmcp/)
  })
  it('mentions at least one of the canonical MCP function-call shapes', () => {
    const body = readPacket('mdc-rule.md')
    const hasShape =
      /server\.tool\(/.test(body) ||
      /server\.addTool\(/.test(body) ||
      /mcpServer\.tool\(/.test(body) ||
      /setRequestHandler\(/.test(body)
    expect(hasShape).toBe(true)
  })

  it('does NOT include the fabricated "tools field" trigger heuristic (HF7)', () => {
    // P3.13 R3 second pass found a heuristic claiming MCP servers
    // export "an object literal with a `tools` field whose values
    // are functions." That isn't a documented MCP-server pattern
    // and isn't in the canonical .cursorrules. Pin it out.
    const body = readPacket('mdc-rule.md')
    expect(body).not.toMatch(/object literal with a `tools` field/i)
  })
})

// ─── 5. file-path references actually resolve (HF1) ────────────────────────

/**
 * Strip historical log sections from a markdown file before
 * integrity-checking. The README's ``Notes & outcomes`` section
 * intentionally preserves verbatim quotes of corrected-old-content
 * (e.g. wrong file paths, wrong URLs, contradictory claims) so the
 * audit trail is on file. Those quotes would otherwise trip
 * "this string must not appear" / "this path must resolve"
 * assertions.
 */
function stripHistoricalSections(source: string): string {
  // Remove everything from "## Notes & outcomes" to end-of-file
  // (including any subsequent sections — there are none today).
  return source.replace(/\n## Notes & outcomes[\s\S]*$/, '\n')
}

/**
 * Best-effort extraction of repo-relative file paths mentioned in a
 * markdown file. Targets paths used as "open this file" / "see X" /
 * cross-reference links. Captures:
 *   - Backtick-quoted paths that look like ``packages/...``,
 *     ``apps/...``, ``scripts/...``, ``examples/...``, ``docs/...``.
 *   - Markdown link targets ``[text](relative/path)``.
 *
 * Skips:
 *   - http(s) URLs (handled by external-link checks, out of scope).
 *   - Glob patterns and inline shell snippets.
 *   - Paths inside fenced code blocks (those are illustrative).
 *   - Paths inside the historical "Notes & outcomes" log (those
 *     are documenting old corrected mistakes by design).
 */
function repoPathRefs(source: string): Set<string> {
  const refs = new Set<string>()
  // Strip fenced code blocks AND the historical log first so the
  // checks only see live cross-references.
  const stripped = stripHistoricalSections(source).replace(
    /```[\s\S]*?```/g,
    '',
  )
  const tickRe =
    /`((?:packages|apps|scripts|examples|docs|src|tests)\/[^`\s*]+(?:\.[a-zA-Z0-9]+|\/?))`/g
  for (const [, p] of stripped.matchAll(tickRe)) {
    if (p.includes('*') || p.includes('<') || p.includes('$')) continue
    refs.add(p.replace(/[/]+$/, ''))
  }
  return refs
}

describe('packet — repo-relative file paths resolve', () => {
  // Hostile-review pin (HF1): submission.md and README.md
  // referenced ``examples/mcp-quickstart`` for the positive-test
  // fixture. That path doesn't exist; only ``examples/kernel-demo``
  // does, and it's not an MCP server. Pin every repo-relative path
  // mentioned in the packet docs to actually resolving on disk —
  // a future drift will fail loudly instead of silently misleading
  // the founder.
  for (const docName of ['submission.md', 'README.md', 'mdc-rule.md']) {
    it(`every repo-relative path in ${docName} exists on disk`, () => {
      const refs = [...repoPathRefs(readPacket(docName))]
      const missing = refs.filter((p) => !existsSync(resolve(REPO_ROOT, p)))
      expect(missing).toEqual([])
    })
  }
})

// ─── 6. README — no internal contradictions (HF2) ──────────────────────────

describe('README.md — internal consistency', () => {
  it('does NOT claim cursor.directory "requires" a screenshot (HF2)', () => {
    // P3.13 R3 second pass found README § "Why standalone" claimed
    // "cursor.directory's listing card requires one" while every
    // other section correctly noted the auto-detector does NOT
    // consume a screenshot. Pin the contradiction out — but skip
    // the historical "Notes & outcomes" log, which intentionally
    // quotes the old wrong text for the audit trail.
    const body = stripHistoricalSections(readPacket('README.md'))
    expect(body).not.toMatch(/listing\s+card\s+requires\s+(a\s+)?(one|screenshot)/i)
  })

  it("hostile-review checklist's playbook-step references resolve in mdc-rule.md OR canonical .cursorrules", () => {
    // P3.13 R3 second pass found the checklist saying "step 10 of
    // the playbook" — but mdc-rule.md's playbook only has 7 steps.
    // Step 10 lives in the canonical 12-step .cursorrules. Make sure
    // any "step N of the playbook" reference in the README either
    // (a) is in-range for the in-packet playbook, or (b) is
    // explicitly qualified as belonging to the canonical playbook.
    const readme = readPacket('README.md')
    const ruleBody = readPacket('mdc-rule.md')
    const playbookSection = ruleBody.match(/## Step-by-step playbook\n([\s\S]*?)(?=\n## )/)
    const inPacketSteps = (playbookSection?.[1] ?? '').match(/^\d+\./gm)?.length ?? 0
    expect(inPacketSteps).toBeGreaterThan(0)

    const stepRefs = [...readme.matchAll(/step (\d+)(?:-(\d+))? of the playbook/gi)]
    for (const match of stepRefs) {
      const start = Number(match[1])
      const end = match[2] ? Number(match[2]) : start
      if (start > inPacketSteps || end > inPacketSteps) {
        // Out-of-range for the in-packet playbook — must be qualified
        // as the canonical .cursorrules step.
        const ctx = readme.slice(Math.max(0, match.index! - 80), match.index! + 100)
        expect(ctx).toMatch(/\.cursorrules|canonical playbook/i)
      }
    }
  })
})

// ─── 7. submission.md — submission flow is the verified one (S-DEV-1/2/3) ──

describe('submission.md — submission flow matches verified reality', () => {
  it('points at the canonical submission entry (cursor.directory/plugins/new)', () => {
    expect(readPacket('submission.md')).toMatch(
      /cursor\.directory\/plugins\/new/,
    )
  })

  it('does NOT mention the disproven cursor.directory/generate URL (in instructions)', () => {
    // The hostile-review log in README.md DOES name the wrong URL
    // by design (so future re-readers don't reintroduce it). But
    // submission.md's instructions must not mention it.
    const sub = readPacket('submission.md')
    // Allow it ONLY in the "Common deviation pitfall" callout.
    const pitfallSection = sub.match(/Common deviation pitfall[\s\S]*?(?=\n- |\n## |$)/)?.[0] ?? ''
    const subWithoutPitfall = sub.replace(pitfallSection, '')
    expect(subWithoutPitfall).not.toMatch(/cursor\.directory\/generate/)
  })

  it('describes Open Plugins manifest format (plugin.json)', () => {
    const sub = readPacket('submission.md')
    expect(sub).toMatch(/plugin\.json/)
    expect(sub).toMatch(/Open Plugins/i)
  })

  it('describes the rules/*.mdc location for auto-detection', () => {
    expect(readPacket('submission.md')).toMatch(/rules\/(\*|settlegrid).*\.mdc/)
  })

  it('does NOT promise a GitHub-PR fallback path (S-DEV-2)', () => {
    // The cursor.directory README explicitly says "no pull requests
    // needed for data". Earlier packet revisions described a
    // "Path B — GitHub PR" fallback that doesn't exist. Pin it out.
    const sub = readPacket('submission.md')
    const pitfallSection = sub.match(/Common deviation pitfall[\s\S]*?(?=\n- |\n## |$)/)?.[0] ?? ''
    const subWithoutPitfall = sub.replace(pitfallSection, '')
    expect(subWithoutPitfall).not.toMatch(/Path B[^a-zA-Z]/)
    expect(subWithoutPitfall).not.toMatch(/GitHub[- ]PR fallback/i)
  })
})

// ─── 8. anti-pattern coverage in the rule ──────────────────────────────────

describe('mdc-rule.md — anti-patterns are explicit', () => {
  // Hostile-review pin: a Cursor rule that doesn't call out the
  // failure modes will get the rule auto-applied to non-MCP files
  // and footgun developers. The README hostile-review checklist
  // requires these three calls; pin them out so a refactor doesn't
  // silently drop them.
  const body = (() => readPacket('mdc-rule.md'))()
  it('explicitly says "do NOT hardcode" the API key', () => {
    expect(body).toMatch(/do[\s*]+not[\s*]+hardcode/i)
  })
  it('explicitly says "do NOT wrap" non-MCP files', () => {
    expect(body).toMatch(/do[\s*]+not[\s*]+wrap.*not\s+an?\s+MCP server/is)
  })
  it('explicitly forbids defaultCostCents: 0', () => {
    expect(body).toMatch(/defaultCostCents:\s*0/)
    expect(body).toMatch(/do[\s*]+not[\s*]+set[\s*]+`?defaultCostCents:\s*0`?/i)
  })
})

// ─── 9. pricing claim accuracy (HF1 from R3 first pass) ────────────────────

describe('mdc-rule.md — pricing claim matches the published pricing page', () => {
  it('quotes the 50,000 ops/month free tier (NOT the stale 1,000)', () => {
    // P3.13 R3 first pass found the rule originally said "1,000 free
    // invocations" — copied from the canonical .cursorrules, which
    // had the same stale claim. The published pricing page
    // (apps/web/src/app/pricing/page.tsx) says 50,000 operations/month.
    const body = readPacket('mdc-rule.md')
    expect(body).toMatch(/50,?000\s+operations\s+per\s+month/i)
    expect(body).not.toMatch(/1,?000\s+(free\s+)?invocations\s+per\s+month/i)
  })
})
