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

// ════════════════════════════════════════════════════════════════════════════
// Launch-gate chunk #1 — honest-claims-sweep (2026-06-27)
//
// G1-1 / G1-2 / G1-3 / G1-4 negative guards. Every assertion below is a
// FILE-SCOPED value-literal (never a shared `\b15\b` or blanket `/1,017/`) so
// it fires on the exact retired surface and does NOT false-trip "Next.js 15",
// "$0.15", the 15-protocol-claim.md citation, "50K ops", "150ms", "$50K", or
// the indexed-server surfaces that legitimately keep 1,017. See
// docs/tech-debt/honest-claims-sweep-handoff-2026-06-27.md.
// ════════════════════════════════════════════════════════════════════════════

const STATS_BAR_TSX = repoFile('apps/web/src/components/marketing/stats-bar.tsx')
const SMART_PROXY_TSX = repoFile(
  'apps/web/src/components/marketing/smart-proxy.tsx',
)
const FEATURES_TSX = repoFile('apps/web/src/components/marketing/features.tsx')
const SERVERS_PAGE_TSX = repoFile('apps/web/src/app/servers/page.tsx')
const SERVER_SEARCH_TSX = repoFile('apps/web/src/components/server-search.tsx')
const TOOLS_PAGE_TSX = repoFile('apps/web/src/app/tools/page.tsx')
const FAQ_PAGE_TSX = repoFile('apps/web/src/app/faq/page.tsx')
const DOCS_PAGE_TSX = repoFile('apps/web/src/app/docs/page.tsx')
const USE_CASES_PAGE_TSX = repoFile('apps/web/src/app/use-cases/page.tsx')
const GLOSSARY_PAGE_TSX = repoFile('apps/web/src/app/learn/glossary/page.tsx')
const HOWTO_BILLING_TSX = repoFile(
  'apps/web/src/app/learn/how-mcp-billing-works/page.tsx',
)
const PROTOCOL_SLUG_TSX = repoFile(
  'apps/web/src/app/learn/protocols/[slug]/page.tsx',
)
const HANDBOOK_TSX = repoFile('apps/web/src/app/learn/handbook/page.tsx')
const BLOG_BODY_FREE_TIER = repoFile(
  'apps/web/src/lib/blog-bodies/mcp-server-free-tier-usage-limits.md',
)

// ─── G1-1 — retired "15 protocols" stat / claim ─────────────────────────────

describe('G1-1 — retired "15 protocols" claim', () => {
  it('stats-bar.tsx no longer ships the value:"15" protocol-count stat', () => {
    // File-scoped value-literal: fires on the SPLIT stats-bar form
    // (value:"15" … label:"Payment protocols") that a contiguous
    // /15 protocols/ guard cannot see. "15" is a substring of no other stat
    // value/label, so value:"95–100%" etc. are unaffected. Passes whether the
    // stat is relabeled to "9" or removed entirely.
    expect(STATS_BAR_TSX).not.toMatch(/value:\s*"15"/)
  })

  it('smart-proxy.tsx drops the hyphenated "15-protocol" homepage claim', () => {
    expect(SMART_PROXY_TSX).not.toMatch(/15[- ]protocols?\b/i)
  })

  it('mcp-billing-comparison-2026 blog body drops "15-protocol support"', () => {
    expect(BLOG_BODY_COMPARISON).not.toMatch(/15[- ]protocols?\b/i)
  })
})

// ─── G1-3 — unbacked "<50ms" latency number removed ─────────────────────────

// Nothing in-repo backs a fixed end-to-end "<50ms" (kernel telemetry buckets
// adapter latency to 5s; the only health bound is p95<200ms). The defensible
// architectural statement carries NO magnitude — "a single Redis balance check
// on the hot path; metering batched asynchronously". BOTH the fixed
// "50ms"/"50 milliseconds" end-to-end number (guarded here) AND the
// over-corrected "sub-millisecond" magnitude (DC-16e — guarded by the T1 block
// below) are retired. The `\b50 … \b` bounds mean this does NOT match
// "150ms"/"250ms", "$50K", "50K ops", or "i < 50".
const LATENCY_NUMBER = /\b50\s?(?:ms|milliseconds)\b/i

describe('G1-3 — unbacked "<50ms" latency number removed', () => {
  const latencyScoped = [
    { name: 'stats-bar.tsx', text: STATS_BAR_TSX },
    { name: 'smart-proxy.tsx', text: SMART_PROXY_TSX },
    { name: 'features.tsx', text: FEATURES_TSX },
    { name: 'docs/page.tsx', text: DOCS_PAGE_TSX },
    { name: 'faq/page.tsx', text: FAQ_PAGE_TSX },
    { name: 'use-cases/page.tsx', text: USE_CASES_PAGE_TSX },
    { name: 'learn/glossary/page.tsx', text: GLOSSARY_PAGE_TSX },
    { name: 'learn/how-mcp-billing-works/page.tsx', text: HOWTO_BILLING_TSX },
    { name: 'learn/protocols/[slug]/page.tsx', text: PROTOCOL_SLUG_TSX },
    { name: 'README.md', text: README_MD },
    { name: 'llms.txt', text: LLMS_TXT },
    { name: 'llms-full.txt', text: LLMS_FULL_TXT },
    { name: 'mcp-server-free-tier blog body', text: BLOG_BODY_FREE_TIER },
  ]

  it.each(latencyScoped)(
    "'$name' asserts no fixed \"50ms\" latency number",
    ({ text }) => {
      expect(text).not.toMatch(LATENCY_NUMBER)
    },
  )
})

// ─── G1-2 — "1,017 templates" noun-conflation removed ───────────────────────

// 1,017 = indexed open-source MCP servers (server-catalog.json, rendered at
// /servers, 22 categories). 97 = forkable templates with billing pre-wired
// (registry.totalTemplates, 6 categories). Pairing "1,017" with the template
// noun is the DC-16a defect. Indexed/cataloged-SERVER surfaces legitimately
// KEEP 1,017, so this is a per-surface PHRASE guard, never a blanket /1,017/.
const TEMPLATE_COUNT_CONFLATION =
  /1,017\s+(?:open-source\s+)?(?:MCP\s+)?(?:server\s+)?templates/i

describe('G1-2 — "1,017 templates" noun-conflation removed', () => {
  const conflationScoped = [
    { name: 'servers/page.tsx', text: SERVERS_PAGE_TSX },
    { name: 'server-search.tsx', text: SERVER_SEARCH_TSX },
    { name: 'tools/page.tsx', text: TOOLS_PAGE_TSX },
    { name: 'faq/page.tsx', text: FAQ_PAGE_TSX },
    { name: 'README.md', text: README_MD },
    { name: 'llms.txt', text: LLMS_TXT },
  ]

  it.each(conflationScoped)(
    "'$name' does not pair \"1,017\" with the template noun",
    ({ text }) => {
      expect(text).not.toMatch(TEMPLATE_COUNT_CONFLATION)
    },
  )

  it('indexed-server surfaces legitimately keep "1,017 … servers"', () => {
    // guards against an over-correction that strips the true catalog count
    expect(HANDBOOK_TSX).toMatch(/1,017 open-source MCP servers/)
  })
})

// ─── G1-4 — crypto "supported now" self-claims demoted (rails config-dark) ───

describe('G1-4 — crypto "supported now" self-claims demoted', () => {
  it('docs/page.tsx no longer claims crypto payments are currently supported', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(
      /Crypto payments are supported via the x402 protocol/,
    )
    expect(DOCS_PAGE_TSX).not.toMatch(
      /supports USDC and USDT stablecoins for crypto settlement/,
    )
  })

  it('docs/page.tsx no longer advertises USDT (settlement is USDC-only)', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(/USDT/)
  })

  it('homepage protocols.tsx does not claim live "stablecoin settlement"', () => {
    // Caught by the full-tree re-scan (the handoff list missed components/).
    // The on-chain stablecoin rail is config-dark, so the homepage must not
    // assert live "stablecoin settlement". "stablecoin rails" (coverage) is OK.
    expect(HOMEPAGE_PROTOCOLS_TSX).not.toMatch(/stablecoin settlement/)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// honest-claims-sweep ② RECOVERY (2026-06-27) — badge layer + over-correction
//
// The ② seal blocked on two gaps the original sweep left:
//   • DC-16d — a status ENUM ('Production'/'Ready') is a self-claim, but the
//     grep-based prose re-scan only matched PROSE, so the sibling INDEX badge
//     and the L402/MPP badges shipped live while the [slug] DETAIL prose was
//     demoted. Re-scan EVERY representation (enum/badge) across sibling files.
//   • DC-16e — replacing an unbacked "<50ms" with an unbacked "sub-millisecond"
//     fixes nothing; @upstash/redis is an HTTP/REST client, so the hot-path
//     balance check is a network round-trip, not a sub-ms operation.
// ════════════════════════════════════════════════════════════════════════════

// ─── T1 — over-corrected "sub-millisecond" magnitude removed (DC-16e) ────────

// The defensible architectural statement carries NO magnitude: "a single Redis
// balance check on the hot path; metering batched asynchronously". This guard
// pins the default resolution (drop the magnitude). If a founder later supplies
// a cited in-region Upstash benchmark, restore the wording AND update this
// guard in lockstep (same contract as the G1-3 <50ms guard above). The
// alternation covers "sub-millisecond"/"submillisecond" and "sub-ms"/"subms";
// it does NOT match "sub-second" or the settlement-code "sub-millisecond
// microseconds" timestamp comments (those files are not in this scoped list).
const SUBMS_MAGNITUDE = /sub-?millisecond|sub-?ms\b/i

describe('T1 — over-corrected "sub-millisecond" magnitude removed', () => {
  // L3 (guard-teeth note): at HEAD only docs/page.tsx and
  // learn/how-mcp-billing-works/page.tsx actually carried "sub-millisecond"
  // (where the DC-16e over-correction landed), so only those two could fire RED
  // for THIS change. The other 9 entries below never had the magnitude — they
  // stand as FORWARD-ONLY tripwires against any future re-introduction, not as
  // RED→GREEN evidence for this sweep.
  const subMsScoped = [
    { name: 'smart-proxy.tsx', text: SMART_PROXY_TSX },
    { name: 'features.tsx', text: FEATURES_TSX },
    { name: 'docs/page.tsx', text: DOCS_PAGE_TSX },
    { name: 'faq/page.tsx', text: FAQ_PAGE_TSX },
    { name: 'use-cases/page.tsx', text: USE_CASES_PAGE_TSX },
    { name: 'learn/glossary/page.tsx', text: GLOSSARY_PAGE_TSX },
    { name: 'learn/how-mcp-billing-works/page.tsx', text: HOWTO_BILLING_TSX },
    { name: 'learn/protocols/[slug]/page.tsx', text: PROTOCOL_SLUG_TSX },
    { name: 'README.md', text: README_MD },
    { name: 'llms.txt', text: LLMS_TXT },
    { name: 'llms-full.txt', text: LLMS_FULL_TXT },
  ]

  it.each(subMsScoped)(
    "'$name' carries no unbacked sub-millisecond magnitude claim",
    ({ text }) => {
      expect(text).not.toMatch(SUBMS_MAGNITUDE)
    },
  )
})

// ─── B1 / B2 / B3 — learn/protocols status-badge + self-claim harmonization ──

// FILE-SCOPED value-literals scoped to the individual protocol entry via the
// backer→status pairing — NEVER a bare /Production/ (MCP/REST are legitimately
// Production) or /Ready/. Each fires RED on the pre-fix tree (the entry still
// carries the live badge) and GREEN once the badge is demoted.
const PROTOCOLS_INDEX = repoFile('apps/web/src/app/learn/protocols/page.tsx')

describe('B1/B2/B3 — learn/protocols status-badge harmonization', () => {
  // B17 (round 5) — SUPERSEDES the round-1 B1/B5 x402 Production→Testnet demotion.
  // Under Resolution A (founder pre-check RESOLVED: the public x402 facilitator is
  // reachable in prod and verifies + settles on Base MAINNET — see
  // protocols/x402/facilitator/page.tsx:111 status:'production'), the round-1
  // 'Testnet' badge UNDER-claimed the live mainnet facilitator and disagreed with
  // the facilitator page. Reconciled to ONE consistent status: 'Production'
  // (facilitator live; the platform/proxy x402 settlement layer that the overview
  // prose still scopes "in development" is the part that is pending). File-scoped to
  // the x402 entry via the backer→status pairing — never a bare /Production/ (MCP/
  // REST legitimately Production). Fires RED on the pre-fix tree (the entry still
  // carried 'Testnet'), GREEN once reconciled to 'Production'.
  // FORWARD-ONLY DISCLOSURE (round 6): "the pre-fix tree" above is the uncommitted
  // round-1→4 intermediate, NOT HEAD. At HEAD this entry is ALREADY 'Production'
  // (verified, both index + detail) — the 'Testnet' badge lived only in that
  // intermediate — so the positive toMatch has no committed RED→GREEN and the
  // negative (not 'Testnet') is injection-provable only. This guard stands as a
  // forward-only tripwire against a future re-demotion to 'Testnet'.
  it('B17 — index + detail x402 badge reflects the live facilitator (Production), not under-claimed Testnet', () => {
    expect(PROTOCOLS_INDEX).toMatch(/backer: 'Coinbase',\s*status: 'Production'/)
    expect(PROTOCOL_SLUG_TSX).toMatch(/backer: 'Coinbase',\s*status: 'Production'/)
    expect(PROTOCOLS_INDEX).not.toMatch(/backer: 'Coinbase',\s*status: 'Testnet'/)
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/backer: 'Coinbase',\s*status: 'Testnet'/)
  })

  // B3 — MPP badge demoted from Production. The rail is env-gated
  // (isMppEnabled() === !!STRIPE_MPP_SECRET) and 6 canonical surfaces frame it
  // "pending GA"; 'Production' on the protocol pages was the outlier.
  it('index + detail MPP badge is not Production', () => {
    expect(PROTOCOLS_INDEX).not.toMatch(/backer: 'Stripe \+ Tempo',\s*status: 'Production'/)
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/backer: 'Stripe \+ Tempo',\s*status: 'Production'/)
  })

  // B3 — MPP self-claims softened: not "deep, native … every tool automatically
  // accepts SPTs with zero configuration" while the rail is pending GA.
  it('detail page drops the "deep, native MPP / automatically accepts SPTs" self-claim', () => {
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/deep, native MPP integration/i)
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/automatically accepts Stripe Shared Payment Tokens/i)
  })

  // B4 — docs/page.tsx "Accepting MPP Payments" section reframed pending-GA: not
  // "natively accepts Stripe MPP … zero configuration required" while the rail
  // is env-gated (isMppEnabled() === !!STRIPE_MPP_SECRET; api/proxy dispatches
  // MPP only when enabled). The "How MPP Works" flow + cURL example are KEPT as
  // mechanism education. Both literals fire RED on the pre-fix tree.
  it('docs page MPP section drops the "natively accepts / zero configuration" self-claim', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(/zero configuration required/i)
    expect(DOCS_PAGE_TSX).not.toMatch(/natively accepts Stripe MPP/i)
  })

  // B4 (soft sibling) — llms-full.txt MPP entry no longer leads with the bare
  // present-tense "SettleGrid supports MPP for Stripe-native …" self-claim; it
  // now carries the pending-GA qualifier (mirrors the demoted x402/Circle/L402
  // entries in the same Protocol Support section).
  it('llms-full.txt MPP entry no longer leads with bare "SettleGrid supports MPP for Stripe-native"', () => {
    expect(LLMS_FULL_TXT).not.toMatch(/^SettleGrid supports MPP for Stripe-native/m)
  })

  // B2 — L402 badge demoted from Ready (Lightning settlement is config-dark:
  // isL402Enabled requires LND_REST_URL; prod ships mock invoices only).
  it('index + detail L402 badge is not Ready', () => {
    expect(PROTOCOLS_INDEX).not.toMatch(/backer: 'Lightning Labs',\s*status: 'Ready'/)
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/backer: 'Lightning Labs \(Bitcoin\)',\s*status: 'Ready'/)
  })

  // B2 — L402 self-claims demoted to detection-adapter / in-development.
  it('detail page drops the L402 "deep integration / accept Bitcoin / every tool accepts Lightning" self-claims', () => {
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/deep L402 (support|integration)/i)
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/every tool on the platform can accept Lightning/i)
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/accept Bitcoin alongside fiat/i)
  })

  // B2 — llms-full.txt L402 entry carries the in-development qualifier
  // (mirrors the already-demoted Circle entry at :293 in the same file).
  it('llms-full.txt L402 entry no longer leads with live "Native Bitcoin Lightning micropayments"', () => {
    expect(LLMS_FULL_TXT).not.toMatch(/^Native Bitcoin Lightning micropayments/m)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// honest-claims-sweep ② RECOVERY ROUND 3 (2026-06-27) — universal-quantifier
// FAQ (DC-16g) + badge↔prose word mismatch (DC-16d third recurrence)
//
//   • B6 / DC-16g — a universal-quantifier FAQ ("all supported protocols work
//     automatically … settlement across every protocol") sweeps the config-dark
//     x402 rail into a live works-automatically + on-chain-settlement claim
//     WITHOUT naming x402, so the protocol-NAME re-scan missed it. The same page
//     two FAQs up (:326/:330/:334) was demoted to "in development / not
//     currently available", so the page self-contradicted. Pin the EXACT retired
//     phrases (both unique to the :359 "separate integrations" FAQ), not a broad
//     pattern.
//   • B7 / DC-16d — round-1 demoted the MPP badge 'Production'→'Ready', then B4
//     added "pending general availability" prose; the badge WORD ('Ready' =
//     blue/available) then contradicted the prose WORD on the SAME page. Badge
//     demoted 'Ready'→'Pending' (gray) on BOTH the index and the [slug] detail
//     for index↔detail symmetry. Scoped to the MPP entry via the backer pairing
//     — never a bare /'Ready'/ (other live rails legitimately keep 'Ready').
//   • B9 — the use-cases multi-agent card named config-dark x402 +
//     detection-only L402 as live cross-platform settlement rails; both dropped.
// ════════════════════════════════════════════════════════════════════════════

describe('B6 — docs FAQ no longer sweeps config-dark x402 into a live "works automatically / settles" claim', () => {
  it('drops the universal "settlement across every protocol" claim', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(/settlement across every protocol/i)
  })

  it('drops the universal "all supported protocols work automatically" claim', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(/all supported protocols work automatically/i)
  })
})

describe('B7 — MPP status badge demoted Ready→Pending (agrees with the pending-GA prose)', () => {
  // FORWARD-ONLY (mirrors the T1 disclosure): the MPP badge was 'Production' at
  // HEAD (never 'Ready' in any committed tree), so this not-Ready assertion has
  // no git-reachable RED for THIS sweep — the real HEAD teeth live in the
  // sibling B3 not-Production guard above. This stands as a tripwire against a
  // future Ready re-introduction, not as RED→GREEN evidence for round 3/4.
  it('index + detail MPP badge is not Ready', () => {
    expect(PROTOCOLS_INDEX).not.toMatch(/backer: 'Stripe \+ Tempo',\s*status: 'Ready'/)
    expect(PROTOCOL_SLUG_TSX).not.toMatch(/backer: 'Stripe \+ Tempo',\s*status: 'Ready'/)
  })
})

describe('B9 — use-cases multi-agent card drops config-dark x402 + detection-only L402', () => {
  // x402/L402 appear ONLY in this enumeration in use-cases/page.tsx (confirmed),
  // so the exact retired phrase fires RED pre-fix and GREEN once both are
  // dropped from the live "pay each other across platforms" list.
  it('no longer enumerates x402 + L402 as live cross-platform payment rails', () => {
    expect(USE_CASES_PAGE_TSX).not.toMatch(/including MCP, x402, AP2, L402, and KYAPay/)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// honest-claims-sweep ② RECOVERY ROUND 4 (2026-06-28) — demotion-induced
// contradiction (DC-16h) + the deleted-claim's surviving twin (DC-16d 4th)
//
//   • B11 / DC-16h — the round-3 B10 demotion conflated TWO architecturally
//     distinct x402 primitives that share the name. The STANDALONE public
//     facilitator service (dedicated SETTLEGRID_FACILITATOR_GAS_WALLET_KEY,
//     decoupled from isX402SettlementEnabled — LIVE; see api/x402/facilitator/
//     v1/*, protocols/x402/facilitator/page.tsx status:'production', and the
//     x402-facilitator-launch blog) is NOT the PROXY x402 revenue-settlement
//     path (sg.wrap settles on a developer's behalf from SETTLEGRID_GAS_WALLET_
//     KEY, gated by isX402SettlementEnabled(); api/proxy short-circuits when off
//     — config-DARK). B10 blanket-demoted the chat-assistant line to "in
//     development, not currently available", mislabeling the LIVE facilitator
//     and contradicting its own landing page + launch blog. Reconciled here:
//     facilitator SERVICE = live; proxy revenue settlement / metering layer =
//     in development. The kept proxy-path demotions (docs:330/:338, [slug]:118)
//     remain correct.
//   • B12 / DC-16d (4th recurrence) — B8 DELETED templates/index.html for
//     claiming auto-support + auto-settlement across the dark rails; the
//     byte-identical twin survived in the live /docs FAQ (:706). Demoted too.
//   • B13/B14/B15 — un-swept sibling surfaces: the nevermined CTA named
//     config-dark x402 as a live billing rail; the use-cases card kept
//     detection-only KYAPay in the live "pay each other" claim; the faq
//     fork-workflow verb implied all 1,017 indexed servers are billing-pre-wired
//     templates (only 97 are).
// ════════════════════════════════════════════════════════════════════════════

const CHAT_ROUTE_TS = repoFile('apps/web/src/app/api/chat/route.ts')
const NEVERMINED_PAGE_TSX = repoFile(
  'apps/web/src/app/compare/nevermined/page.tsx',
)

describe('B11 — live x402 facilitator service no longer mislabeled "not currently available"', () => {
  // File-scoped to CHAT_ROUTE_TS; pins the EXACT round-3 B10 retired phrase
  // (em-dash + "in development, not currently available" on the facilitator
  // line). Fires RED on the pre-fix tree, GREEN after the rescope.
  // FORWARD-ONLY DISCLOSURE (round 5): the retired phrase this negative pins
  // existed only in the uncommitted round-3 build, so its RED is reachable only
  // on that tree — there is no git-reachable RED from any committed tree. The
  // sibling positive guard below ("runs a public x402 facilitator") carries the
  // real teeth; this stands as a tripwire against the phrase's re-introduction.
  it('chat route no longer demotes the facilitator to "in development, not currently available"', () => {
    expect(CHAT_ROUTE_TS).not.toMatch(
      /facilitator for on-chain USDC settlement \(Base network\) — in development, not currently available/,
    )
  })

  it('chat route states the public x402 facilitator runs as a live service', () => {
    expect(CHAT_ROUTE_TS).toMatch(/SettleGrid runs a public x402 facilitator/)
  })
})

describe('B12 — docs FAQ twin of the deleted index.html auto-settlement claim demoted', () => {
  // The trailing sentence at docs:706 was byte-identical to the deleted
  // templates/index.html:159 sentence. "handles settlement automatically" is
  // unique to :706 within docs/page.tsx (the how-mcp-billing-works:174
  // occurrence is the legit Stripe-Connect line in a DIFFERENT file, not
  // scanned by DOCS_PAGE_TSX). Pin retired phrases unique to the false twin.
  it('drops the "handles settlement automatically" assertion for the config-dark rails', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(
      /each incoming request and handles settlement automatically/,
    )
  })

  it('drops the "automatically supports the agent payment protocols" live framing', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(
      /automatically supports the agent payment protocols/,
    )
  })
})

describe('B13/B14/B15 — un-swept sibling surfaces reconciled', () => {
  // B13 — nevermined CTA no longer names config-dark x402 as a live billing
  // rail. The :52 "x402 settlement layer" SEO keyword is left intact: the live
  // facilitator settles x402, so it is defensible.
  it('nevermined CTA drops x402 from the live "billing any … tool" enumeration', () => {
    expect(NEVERMINED_PAGE_TSX).not.toMatch(/billing\s+any MCP, x402, or AP2 tool/)
  })

  // B14 — use-cases multi-agent card drops detection-only KYAPay from the live
  // "pay each other across platforms" claim (consistent with B9 dropping
  // x402+L402; KYAPay is detection-only per api/chat:33). The earlier B9 phrase
  // is already absent; this pins the round-4 retired form.
  // FORWARD-ONLY DISCLOSURE (round 5): this round-4 retired form lived only in
  // the uncommitted round-3 build, so its RED is reachable only on that tree —
  // no git-reachable RED from any committed tree. Stands as a re-introduction
  // tripwire; the B9 phrase guard above is the HEAD-anchored teeth for this card.
  it('use-cases card no longer enumerates detection-only KYAPay as a live rail', () => {
    expect(USE_CASES_PAGE_TSX).not.toMatch(/including MCP, AP2, and KYAPay/)
  })

  // B15 — faq fork-workflow no longer implies all 1,017 indexed servers are
  // billing-pre-wired ("add your API key"); aligned to the sibling
  // servers/page + tools/page "fork on GitHub, add SettleGrid billing" framing.
  // The true 1,017-servers count is kept (these are indexed servers, not
  // forkable templates — only 97 are).
  // FORWARD-ONLY DISCLOSURE (round 5): the exact retired phrase pinned here
  // existed only in the uncommitted round-3 build, so its RED is reachable only
  // on that tree — no git-reachable RED from any committed tree. The G1-2
  // TEMPLATE_COUNT_CONFLATION suite carries the HEAD-anchored teeth for FAQ_PAGE.
  it('faq fork-workflow drops the "add your API key" pre-wired implication', () => {
    expect(FAQ_PAGE_TSX).not.toMatch(
      /Fork one of our 1,017 open-source MCP servers, add your API key/,
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
// honest-claims-sweep ② RECOVERY ROUND 5 (2026-06-28) — the LIVENESS-claim left
// un-reconciled against its uniformly-demoted FAQ siblings (DC-16d/DC-16h, 5th)
//
//   • B16 / DC-16d (5th recurrence) — the round-4 B11 fix INTRODUCED a "live
//     facilitator" claim at docs:326 (the standalone x402 facilitator verifies +
//     settles on Base mainnet — architecturally TRUE; decoupled from
//     isX402SettlementEnabled, dedicated SETTLEGRID_FACILITATOR_GAS_WALLET_KEY)
//     but left five SIBLING FAQs on the SAME /docs accordion (:75/:211/:330/:334/
//     :338/:359) asserting the categorical opposite ("on-chain crypto settlement
//     … is in development and not currently available"). A reader expanding two
//     adjacent FAQs saw "we settle x402 on Base mainnet" next to "x402 on-chain
//     settlement is not currently available" — the exact DC-16 self-contradiction
//     the sweep exists to kill, newly created by the B11 fix. Resolution A
//     (founder pre-check RESOLVED: facilitator reachable in prod): KEEP the live
//     claim and re-scope every demoted sibling to the in-development PROXY/
//     platform-revenue path (settling the developer's OWN tool revenue on-chain),
//     so the page states ONE consistent status. These guards pin the RETIRED
//     categorical denials (unique to their FAQs) so the contradiction cannot
//     silently reappear, AND positively pin the live-facilitator claim that makes
//     them contradictory. Each negative fires RED on the pre-fix tree (the
//     categorical phrase is present) and GREEN after the rescope.
// ════════════════════════════════════════════════════════════════════════════

describe('B16 — docs x402 cluster reconciled to ONE status (live facilitator + in-dev proxy), no self-contradiction', () => {
  // POSITIVE anchor: the live-facilitator claim (docs:326) must stay present —
  // it is the claim the categorical denials below contradict. If a future edit
  // re-demotes it, this fails and forces a whole-cluster re-reconciliation.
  it('docs page asserts the live standalone x402 facilitator (verify + settle on Base mainnet)', () => {
    expect(DOCS_PAGE_TSX).toMatch(
      /SettleGrid runs a public x402 facilitator \(verify \+ settle on Base mainnet and Base Sepolia\)/,
    )
  })

  // NEGATIVE anchors: the retired categorical denials, each unique to its FAQ in
  // docs/page.tsx. RED pre-fix (present), GREEN after the sibling rescope.
  // FORWARD-ONLY DISCLOSURE (round 6): "RED pre-fix" here means the uncommitted
  // round-4 intermediate, NOT a committed tree. These categorical denials were
  // INTRODUCED mid-chunk (round-4 demotion wording) and rescoped in round 5, so
  // they exist on NO committed tree — HEAD predates the chunk and carried the
  // ORIGINAL live claim instead. Their RED is therefore injection-provable only,
  // not git-reachable. The positive anchor above is the HEAD-anchored sibling
  // with the real teeth: its phrase is absent at HEAD (verified count 0) and
  // present now, so it fires RED on HEAD and passes GREEN here. These three
  // negatives stand as re-introduction tripwires.
  it('drops the :330 categorical "on-chain crypto settlement (USDC via x402) is … not currently available"', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(
      /On-chain crypto settlement \(USDC via the x402 protocol\) is in development and not currently available/,
    )
  })

  it('drops the :211 categorical "Crypto payments via the x402 protocol (USDC) are … not currently available"', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(
      /Crypto payments via the x402 protocol \(USDC\) are in development and not currently available/,
    )
  })

  it('drops the :359 categorical "x402 and other on-chain rails are … not currently available"', () => {
    expect(DOCS_PAGE_TSX).not.toMatch(
      /x402 and other on-chain rails are in development and not currently available/,
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
// honest-claims-sweep ② RECOVERY ROUND 6 (2026-06-28) — the within-entry sibling
// left un-reconciled on the /learn/protocols/x402 detail page (DC-16, 6th)
//
//   • B19 / DC-16 (6th recurrence) — round 5 demoted the x402 entry's `overview`
//     and `integration` to scope the metering/budgets/analytics layer as "in
//     development", but left the sibling `howItWorks` ¶3 in the SAME entry
//     asserting that exact layer LIVE ("SettleGrid extends x402 with credit-based
//     budgets, rate limiting, and analytics … SettleGrid handles the metering").
//     A reader saw the overview call the layer in-development next to howItWorks
//     describing it as a present-tense live capability — the same within-surface
//     self-contradiction class as the B16 /docs blocker. The howItWorks ¶3 is
//     rescoped to the in-development platform/proxy layer (mirroring the overview
//     + the integration's "When that layer is live" framing); the facilitator
//     verify+settle-on-Base half stays live. UNLIKE the forward-only negatives,
//     this one has REAL COMMITTED TEETH: the retired phrase is present at HEAD
//     (the chunk predates HEAD and howItWorks ¶3 was never demoted), so it fires
//     RED on HEAD and GREEN after the rescope.
// ════════════════════════════════════════════════════════════════════════════

describe('B19 — [slug] x402 howItWorks no longer asserts the in-development metering layer live', () => {
  it('retires the live "SettleGrid extends x402 with credit-based budgets, rate limiting, and analytics" phrase', () => {
    expect(PROTOCOL_SLUG_TSX).not.toMatch(
      /SettleGrid extends x402 with credit-based budgets, rate limiting, and analytics/,
    )
  })
})
