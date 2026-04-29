/**
 * Regression tests for P1.MKT1 honest-framing rewrite (second addendum,
 * 2026-04-15). These tests read public-facing content files as text and
 * assert that each retired phrase is absent and each canonical phrase is
 * present.
 *
 * Scope of this guard:
 *
 *   - `README.md` — the repo's public GitHub README.
 *   - `apps/web/public/llms.txt` and `apps/web/public/llms-full.txt` —
 *     the public LLM-prompting references served at settlegrid.ai/llms.txt.
 *   - `apps/web/public/.well-known/mcp.json` — MCP discovery manifest.
 *   - `apps/web/src/lib/blog-posts.ts` — blog post metadata (descriptions,
 *     FAQs) for posts at settlegrid.ai/learn/blog.
 *   - `apps/web/src/lib/blog-bodies/ai-agent-payment-protocols.md` and
 *     `apps/web/src/lib/blog-bodies/mcp-billing-comparison-2026.md` — the
 *     blog body content for the two posts that enumerated protocols.
 *   - `apps/web/src/components/marketing/protocols.tsx` and
 *     `apps/web/src/components/marketing/platform/platform-agents.tsx` —
 *     the protocol pill lists on the homepage and the platform-agents page.
 *
 * The test file is intentionally aligned with
 * `apps/web/src/__tests__/privacy-notice-regression.test.ts` (same style,
 * same helper pattern). It reads files as text (readFileSync) rather than
 * importing TypeScript modules so the assertions cover string literals
 * that would not necessarily be exported.
 *
 * What this test does NOT cover (deferred / out of scope):
 *   - Internal planning docs (MASTER_PLAN.md, NUCLEAR_EXPANSION_PLAN.md,
 *     etc.) which carry a historical-snapshot banner in their own body.
 *   - SDK-internal class names / `name` identifiers like 'mpp',
 *     'circle-nano', 'mastercard-vi' which are kept for ABI compat.
 *   - Internal adapter shorthand in SDK JSDoc (e.g., "MPP" as an
 *     abbreviation for the runtime adapter) where the context makes the
 *     reference unambiguous.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')

function repoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8')
}

const README_MD = repoFile('README.md')
const LLMS_TXT = repoFile('apps/web/public/llms.txt')
const LLMS_FULL_TXT = repoFile('apps/web/public/llms-full.txt')
const MCP_JSON = repoFile('apps/web/public/.well-known/mcp.json')
const BLOG_POSTS_TS = repoFile('apps/web/src/lib/blog-posts.ts')
const BLOG_BODY_PROTOCOLS = repoFile(
  'apps/web/src/lib/blog-bodies/ai-agent-payment-protocols.md',
)
const BLOG_BODY_COMPARISON = repoFile(
  'apps/web/src/lib/blog-bodies/mcp-billing-comparison-2026.md',
)
const HOMEPAGE_PROTOCOLS_TSX = repoFile(
  'apps/web/src/components/marketing/protocols.tsx',
)
const PLATFORM_AGENTS_TSX = repoFile(
  'apps/web/src/components/marketing/platform/platform-agents.tsx',
)

// ─── Shared retired-phrase list ─────────────────────────────────────────────

/**
 * Phrases whose presence anywhere in a public-facing file represents a
 * regression of the P1.MKT1 honest framing. Each entry targets a specific
 * retired claim, NOT a specific canonical name (some canonical names like
 * "Mastercard Verifiable Intent" are substrings of phrases that are also
 * fine in rename-annotation context, so we guard on phrases with explicit
 * positive framing).
 */
const RETIRED_CLAIMS = [
  // The literal marketing claim P1.MKT1 retired.
  /\b15 payment protocols\b/,
  /\b15 protocols\b/,
  // "10 payment protocols" / "10 protocols" were a second-draft framing
  // that also overcounts. Retired.
  /\b10 payment protocols\b/,
  // The stale Stripe MPP expansion. "Machine Payments Protocol" is
  // canonical; "Merchant Payment Protocol" is retired.
  /\bMerchant Payment Protocol\b/,
]

const RETIRED_NAME_CLAIMS: Array<{ phrase: RegExp; reason: string }> = [
  // "Mastercard Agent Pay" as a positive claim (e.g., in a protocol list).
  // Allowed in rename-annotation context where we explicitly say the name
  // was retired, so the matcher looks for the name appearing as an active
  // list entry rather than anywhere.
  {
    phrase: /, Mastercard Agent Pay,|, Mastercard Agent Pay\./,
    reason: "'Mastercard Agent Pay' retired; canonical is 'Mastercard Verifiable Intent'",
  },
  // "Alipay Trust" as a positive claim (comma-bounded or trailing) is retired.
  {
    phrase: /, Alipay Trust,|, Alipay Trust\.|, Alipay Trust, and/,
    reason: "'Alipay Trust' retired; canonical is 'ACTP' / 'Agentic Commerce Trust Protocol'",
  },
  // "Circle Nano" as a positive claim (without the 'payments' suffix).
  // Word-boundary regex to guard against 'Circle Nanopayments' matching.
  {
    phrase: /\bCircle Nano(?!payments)\b/,
    reason: "'Circle Nano' retired; canonical is 'Circle Nanopayments'",
  },
]

function assertNoRetiredPhrases(fileName: string, text: string): void {
  for (const pattern of RETIRED_CLAIMS) {
    expect(
      text,
      `${fileName} contains retired phrase matching ${pattern}`,
    ).not.toMatch(pattern)
  }
  for (const { phrase, reason } of RETIRED_NAME_CLAIMS) {
    expect(
      text,
      `${fileName} contains retired name phrase: ${reason}`,
    ).not.toMatch(phrase)
  }
}

// ─── README ─────────────────────────────────────────────────────────────────

describe('README.md — honest framing', () => {
  it('does not contain the retired 10-protocol list or "15 protocols" claim', () => {
    assertNoRetiredPhrases('README.md', README_MD)
  })

  it('uses the canonical 9 brokered + 2 detection + 3 emerging structure', () => {
    expect(README_MD).toMatch(/brokered by the Smart Proxy/)
    expect(README_MD).toMatch(/detection-adapter-only/)
    expect(README_MD).toMatch(/tracked as emerging/)
  })

  it('references the canonical protocol names', () => {
    expect(README_MD).toContain('Stripe MPP')
    expect(README_MD).toContain('Mastercard Verifiable Intent')
    expect(README_MD).toContain('Circle Nanopayments')
    expect(README_MD).toContain('ACTP')
    expect(README_MD).toContain("Alipay's Agentic Commerce Trust Protocol")
  })
})

// ─── LLM reference files ────────────────────────────────────────────────────

describe('apps/web/public/llms.txt — honest framing', () => {
  it('does not contain retired protocol claims', () => {
    assertNoRetiredPhrases('llms.txt', LLMS_TXT)
  })

  it('uses the 9 brokered / 2 detection / 3 emerging framing', () => {
    expect(LLMS_TXT).toMatch(/9 (?:agent payment )?protocols/)
    expect(LLMS_TXT).toContain('Stripe MPP')
    expect(LLMS_TXT).toContain('Mastercard Verifiable Intent')
    expect(LLMS_TXT).toContain('Circle Nanopayments')
  })
})

describe('apps/web/public/llms-full.txt — honest framing', () => {
  it('does not contain retired protocol claims', () => {
    assertNoRetiredPhrases('llms-full.txt', LLMS_FULL_TXT)
  })

  it('uses the canonical MPP expansion (Machine Payments Protocol)', () => {
    expect(LLMS_FULL_TXT).toContain('Machine Payments Protocol')
  })

  it('has the canonical Mastercard section heading (not "Mastercard Agent Pay")', () => {
    expect(LLMS_FULL_TXT).toMatch(/^### Mastercard Verifiable Intent$/m)
  })

  it('has the canonical ACTP section heading (not "Alipay Trust Protocol")', () => {
    expect(LLMS_FULL_TXT).toMatch(/^### ACTP — Alipay's Agentic Commerce Trust Protocol/m)
  })
})

// ─── Discovery manifest ─────────────────────────────────────────────────────

describe("apps/web/public/.well-known/mcp.json — honest framing", () => {
  const manifest = JSON.parse(MCP_JSON) as {
    protocols: string[]
    [key: string]: unknown
  }

  it('has the canonical protocols array (9 brokered + 2 detection = 11 entries)', () => {
    expect(manifest.protocols).toHaveLength(11)
  })

  it('does not include retired protocol names', () => {
    const retired = ['Mastercard Agent Pay', 'Circle Nano', 'Alipay Trust', 'REST']
    for (const name of retired) {
      expect(
        manifest.protocols,
        `manifest.protocols should not contain '${name}'`,
      ).not.toContain(name)
    }
  })

  it('includes the canonical names', () => {
    const canonical = [
      'MCP',
      'x402',
      'Stripe MPP',
      'AP2',
      'ACP',
      'UCP',
      'Visa TAP',
      'Mastercard Verifiable Intent',
      'Circle Nanopayments',
      'L402',
      'KYAPay',
    ]
    for (const name of canonical) {
      expect(manifest.protocols).toContain(name)
    }
  })
})

// ─── Blog post metadata ─────────────────────────────────────────────────────

describe('blog-posts.ts — honest framing', () => {
  it('does not contain the retired "15 payment protocols" or "10 payment protocols" claim', () => {
    assertNoRetiredPhrases('blog-posts.ts', BLOG_POSTS_TS)
  })

  it('uses canonical protocol names in public FAQ answers', () => {
    expect(BLOG_POSTS_TS).toContain('Stripe MPP')
    expect(BLOG_POSTS_TS).toContain('Mastercard Verifiable Intent')
    expect(BLOG_POSTS_TS).toContain('Circle Nanopayments')
  })

  it('describes the AI agent payment protocols post using the honest tier structure', () => {
    // The FAQ rewrite should talk about "9 brokered" / "2 detection" /
    // "3 emerging" (or equivalent) rather than "10 major AI agent payment
    // protocols" with stale names.
    expect(BLOG_POSTS_TS).toMatch(/9 (?:brokered|protocols).*Smart Proxy|Smart Proxy.*9 protocols/)
    expect(BLOG_POSTS_TS).toMatch(/detection|tracked|emerging/)
  })
})

// ─── Blog bodies ────────────────────────────────────────────────────────────

describe('blog-body: ai-agent-payment-protocols.md — honest framing', () => {
  it('does not contain "Merchant Payment Protocol" (retired expansion)', () => {
    expect(BLOG_BODY_PROTOCOLS).not.toContain('Merchant Payment Protocol')
  })

  it('uses "Machine Payments Protocol" as the canonical MPP expansion', () => {
    expect(BLOG_BODY_PROTOCOLS).toContain('Machine Payments Protocol')
  })

  it('table row and recommendation copy use canonical names', () => {
    expect(BLOG_BODY_PROTOCOLS).toContain('| Stripe MPP |')
    expect(BLOG_BODY_PROTOCOLS).toContain('| Mastercard Verifiable Intent |')
  })
})

describe('blog-body: mcp-billing-comparison-2026.md — honest framing', () => {
  it('does not contain "Merchant Payment Protocol" (retired expansion)', () => {
    expect(BLOG_BODY_COMPARISON).not.toContain('Merchant Payment Protocol')
  })

  it('uses "Machine Payments Protocol" as the canonical MPP expansion', () => {
    expect(BLOG_BODY_COMPARISON).toContain('Machine Payments Protocol')
  })

  it('does not contain the "10 payment protocols" framing', () => {
    expect(BLOG_BODY_COMPARISON).not.toMatch(/\b10 payment protocols\b/)
    expect(BLOG_BODY_COMPARISON).not.toMatch(/\b10 protocols\b/)
  })
})

// ─── Homepage / platform pages ──────────────────────────────────────────────

describe('homepage protocols.tsx — honest framing', () => {
  it('does not contain the retired list entries', () => {
    expect(HOMEPAGE_PROTOCOLS_TSX).not.toMatch(/"Circle Nano"(?!payments)/)
    expect(HOMEPAGE_PROTOCOLS_TSX).not.toContain('"Alipay Trust"')
    expect(HOMEPAGE_PROTOCOLS_TSX).not.toContain('"Mastercard Agent Pay"')
  })

  it('contains the 9 brokered + 2 detection canonical entries as string literals', () => {
    expect(HOMEPAGE_PROTOCOLS_TSX).toContain('"Stripe MPP"')
    expect(HOMEPAGE_PROTOCOLS_TSX).toContain('"Mastercard Verifiable Intent"')
    expect(HOMEPAGE_PROTOCOLS_TSX).toContain('"Circle Nanopayments"')
    expect(HOMEPAGE_PROTOCOLS_TSX).toContain('"KYAPay"')
    expect(HOMEPAGE_PROTOCOLS_TSX).toContain('"L402"')
  })
})

describe('platform-agents.tsx — honest framing', () => {
  it('does not contain retired protocol names as list entries', () => {
    // The pre-rename list had bare "Circle Nano", "Alipay Trust",
    // "REST", and "EMVCo". None of these should be in the current list.
    expect(PLATFORM_AGENTS_TSX).not.toMatch(/'Circle Nano'(?!payments)/)
    expect(PLATFORM_AGENTS_TSX).not.toContain("'Alipay Trust'")
    expect(PLATFORM_AGENTS_TSX).not.toContain("'Mastercard Agent Pay'")
    // "REST" as a list entry — check the literal string in a quoted
    // context (the file has no other 'REST' string literals).
    expect(PLATFORM_AGENTS_TSX).not.toMatch(/'REST'/)
  })

  it('uses the canonical "14 agent payment protocols" tagline rather than "15 payment protocols"', () => {
    expect(PLATFORM_AGENTS_TSX).not.toMatch(/\b15 payment protocols\b/)
    // Must mention some count — confirm 14 is present.
    expect(PLATFORM_AGENTS_TSX).toContain('14')
  })
})

// ─── Cross-cutting: canonical spec names appear consistently ────────────────

describe('cross-file consistency — canonical names present where expected', () => {
  const publicFilesWithProtocolLists = [
    { name: 'README.md', text: README_MD },
    { name: 'llms.txt', text: LLMS_TXT },
    { name: 'llms-full.txt', text: LLMS_FULL_TXT },
    { name: 'blog-posts.ts', text: BLOG_POSTS_TS },
  ]

  it.each(publicFilesWithProtocolLists)(
    "'$name' contains the canonical 'Stripe MPP' name",
    ({ text }) => {
      expect(text).toContain('Stripe MPP')
    },
  )

  it.each(publicFilesWithProtocolLists)(
    "'$name' contains the canonical 'Mastercard Verifiable Intent' name",
    ({ text }) => {
      expect(text).toContain('Mastercard Verifiable Intent')
    },
  )

  it.each(publicFilesWithProtocolLists)(
    "'$name' contains the canonical 'Circle Nanopayments' name",
    ({ text }) => {
      expect(text).toContain('Circle Nanopayments')
    },
  )
})
