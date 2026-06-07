/**
 * P2.MKT1 / P4.MKT3 — comparison data for the SettleGrid vs Nevermined page.
 *
 * Every cell carries a `cite` note that lets a reader (or a fact-check
 * agent) trace the claim to one of:
 *   1. Shipped code in this repo (cited with a repo-relative path).
 *   2. A verifiable external URL (nevermined.ai, PyPI, GitHub).
 *
 * Source of truth for the positioning:
 * `private/master-plan/competitive-positioning.md`.
 *
 * If Nevermined lands a feature we claimed they lacked, or SettleGrid's
 * shipped claim regresses, update BOTH this file AND the strategy doc.
 *
 * Citation policy:
 *   - SettleGrid claims cite a repo path (linked via gh()).
 *   - Nevermined claims cite the most specific public URL we have. Where
 *     a per-claim permalink hasn't been surfaced yet, the cite links to
 *     the relevant docs/blog index. Sharpen as specific URLs surface.
 *   - Numeric counts (templates, adapters) reflect the repo state at the
 *     last reviewed date in page.tsx. Update both this file and the
 *     reviewed date when these drift.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gh } from './helpers'

/**
 * Adapter inventory — single source of truth for the "9 shipped
 * adapters" claim. Update this list when a new protocol adapter
 * ships in apps/web/src/lib/settlement/adapters/. The `cite` text
 * and `value` text below interpolate from this list, so the page
 * never drifts from the data on a count change.
 */
export const SHIPPED_ADAPTERS = [
  'MCP',
  'x402',
  'AP2',
  'MPP',
  'ACP',
  'UCP',
  'Visa TAP',
  'Mastercard VI',
  'Circle Nano',
] as const

/**
 * Open-source-server template count — computed at module load time
 * from the actual repo state. Falls back to the last measured value
 * if all filesystem-read candidates fail. This way the page's count
 * claim auto-syncs with reality on every build.
 *
 * NOT EDGE-SAFE: this module imports `node:fs`. Importing data.ts in
 * an edge-runtime route (e.g., a route with `export const runtime =
 * 'edge'`) will crash at module load. Server components and Node-
 * runtime API routes are fine.
 *
 * Path resolution tries multiple candidates rather than assuming
 * `process.cwd() === apps/web`, so it survives:
 *   - `next build` from apps/web (the normal case)
 *   - vitest run from the monorepo root
 *   - vitest run from apps/web
 *   - any cwd where `open-source-servers/` is reachable as a sibling
 *     of `apps/`
 *
 * Returned counts below 100 are treated as suspect (likely the wrong
 * dir or a partial filesystem) and fall through to the next candidate
 * or the fallback.
 */
const TEMPLATE_COUNT_FALLBACK = 954
const TEMPLATE_COUNT_SANITY_FLOOR = 100
function computeTemplateCount(): number {
  const cwd = process.cwd()
  const candidatePaths = [
    join(cwd, '..', '..', 'open-source-servers'), // from apps/web
    join(cwd, 'open-source-servers'),              // from repo root
    join(cwd, '..', 'open-source-servers'),        // from apps/
  ]
  for (const candidate of candidatePaths) {
    try {
      const count = readdirSync(candidate, { withFileTypes: true }).filter(
        (e) => e.isDirectory() && !e.name.startsWith('.'),
      ).length
      if (count >= TEMPLATE_COUNT_SANITY_FLOOR) {
        return count
      }
    } catch {
      // Try the next candidate.
    }
  }
  return TEMPLATE_COUNT_FALLBACK
}
export const TEMPLATE_COUNT = computeTemplateCount()

export type Cell = {
  value: string
  cite: string
  /**
   * One-click verification link. For shipped-code citations: a GitHub
   * link to the file or directory on `main`. For external claims: the
   * upstream URL. When absent, the cite text is non-clickable (use only
   * for narrative notes that have no single source URL).
   */
  sourceUrl?: string
}

export type Dimension = {
  label: string
  settlegrid: Cell
  nevermined: Cell
}

export type Point = {
  claim: string
  cite: string
  sourceUrl?: string
}

export const dimensions: Dimension[] = [
  {
    label: 'Protocol breadth',
    settlegrid: {
      value: `${SHIPPED_ADAPTERS.length} shipped adapters`,
      cite: `${SHIPPED_ADAPTERS.join(', ')} — apps/web/src/lib/settlement/adapters/`,
      sourceUrl: gh('apps/web/src/lib/settlement/adapters'),
    },
    nevermined: {
      value: '3 production + 1 demo',
      cite:
        'x402 (primary, production), MCP, A2A extension + AP2 (Jan 2026 demo on Base Sepolia testnet)',
      sourceUrl: 'https://docs.nevermined.ai',
    },
  },
  {
    label: 'Default rail',
    settlegrid: {
      value: 'Protocol-neutral (runtime detection)',
      cite:
        'Every request routed through protocolRegistry.detect() — packages/mcp/src/adapters/',
      sourceUrl: gh('packages/mcp/src/adapters'),
    },
    nevermined: {
      value: 'USDC on Base (crypto-first)',
      cite:
        'Default settlement rail per public docs; Stripe Connect available as fiat alternative',
      sourceUrl: 'https://docs.nevermined.ai',
    },
  },
  {
    label: 'Take rate',
    settlegrid: {
      value: '0% → 5% progressive',
      cite:
        '0% on first $1K/mo, 2% $1K–$10K, 2.5% $10K–$50K, 5% $50K+ — apps/web/src/app/pricing/page.tsx',
      sourceUrl: '/pricing',
    },
    nevermined: {
      value: '2% flat (+ Stripe fees on fiat)',
      cite: 'Public pricing page',
      sourceUrl: 'https://nevermined.ai/pricing',
    },
  },
  {
    label: 'SDK languages',
    settlegrid: {
      value: 'TypeScript shipped; Python in development',
      cite:
        '@settlegrid/mcp + ai-sdk + mastra + langchain + n8n + cursor on npm; packages/sdk-python not yet published to PyPI',
      sourceUrl: 'https://www.npmjs.com/org/settlegrid',
    },
    nevermined: {
      value: 'TypeScript + Python',
      cite: 'payments (TS) and payments-py (Python)',
      sourceUrl: 'https://github.com/nevermined-io/payments-py',
    },
  },
  {
    label: 'Named customers',
    settlegrid: {
      value: 'None public yet (launch phase)',
      cite: 'Honest state — launching publicly; named customer is a Phase-4 milestone',
    },
    nevermined: {
      value: 'Valory/Olas (investor-customer)',
      cite: 'Valory is also a seed angel investor',
      sourceUrl: 'https://nevermined.ai',
    },
  },
  {
    label: 'Multi-hop settlement primitives',
    settlegrid: {
      value: 'Atomic commit/rollback across agent chains',
      cite:
        'recordHop, finalizeSession, processSettlementBatch, rollbackSettlementBatch — apps/web/src/lib/settlement/sessions.ts',
      sourceUrl: gh('apps/web/src/lib/settlement/sessions.ts'),
    },
    nevermined: {
      value: 'Not documented as a shipped primitive',
      cite: 'No equivalent in public Nevermined docs as of 2026-04-17',
      sourceUrl: 'https://docs.nevermined.ai',
    },
  },
  {
    label: 'Framework distribution',
    settlegrid: {
      value: `CLI + 5 adapter packages + ${TEMPLATE_COUNT} templates`,
      cite: `create-settlegrid-tool, @settlegrid/{ai-sdk,mastra,langchain,n8n,cursor}, settlegrid-mcpb + open-source-servers/ (${TEMPLATE_COUNT} templates)`,
      sourceUrl: gh('packages'),
    },
    nevermined: {
      value: 'SDKs only (TS + Python)',
      cite: 'No CLI, no framework adapter packages, no template catalog per public docs',
      sourceUrl: 'https://docs.nevermined.ai',
    },
  },
  {
    label: 'Geographic coverage',
    settlegrid: {
      value: 'Stripe Connect + Asia-Pacific rail stubs',
      cite:
        'alipay-proxy, kyapay-proxy, emvco-proxy, drain-proxy stubs — apps/web/src/lib/ (experimental status documented per file)',
      sourceUrl: gh('apps/web/src/lib/alipay-proxy.ts'),
    },
    nevermined: {
      value: 'Stripe Connect + EUR/EURC',
      cite: 'EUR/EURC announced March 2026',
      sourceUrl: 'https://nevermined.ai/blog',
    },
  },
  {
    label: 'Compliance posture',
    settlegrid: {
      value: 'Shipped compliance / identity / fraud / currency primitives',
      cite:
        'apps/web/src/lib/settlement/{compliance,identity,currency}.ts + apps/web/src/lib/fraud.ts',
      sourceUrl: gh('apps/web/src/lib/settlement'),
    },
    nevermined: {
      value: 'Not documented as shipped',
      cite: 'No equivalent public docs as of 2026-04-17',
      sourceUrl: 'https://docs.nevermined.ai',
    },
  },
]

/**
 * Note on `neverminedStronger`: the original P2.MKT1 list had 8 items.
 * Item "Public x402 facilitator as a network service" was removed on
 * 2026-05-01 (P4.MKT3) after SettleGrid shipped facilitator.settlegrid.ai
 * (P4.MKT2). Both projects now operate a public facilitator; it is no
 * longer a Nevermined-stronger differentiator. The strategy doc still
 * lists it pending a separate update.
 */
export const neverminedStronger: Point[] = [
  {
    claim: 'Named reference customer',
    cite: 'Valory/Olas (investor-customer) — still a procurement signal SettleGrid has not yet matched',
    sourceUrl: 'https://nevermined.ai',
  },
  {
    claim: 'Python SDK on PyPI today',
    cite:
      "payments-py is published to PyPI. SettleGrid's settlegrid Python SDK lives in packages/sdk-python but is not yet published.",
    sourceUrl: 'https://pypi.org/project/payments-py/',
  },
  {
    claim: 'Brand and SEO head start',
    cite:
      '~30 blog posts ranking for "AI agent payments" and "agentic commerce" since early 2025',
    sourceUrl: 'https://nevermined.ai/blog',
  },
  {
    claim: 'Public funding signal',
    cite:
      '$4M seed January 2025 (Generative Ventures lead; Polymorphic, Halo, Arca participating) — creates procurement credibility',
    sourceUrl:
      'https://fintech.global/2025/01/10/nevermined-secures-4m-to-revolutionise-ai-commerce-with-ai-payment-protocol/',
  },
  {
    claim: 'EUR/EURC multi-currency',
    cite:
      'EUR via Card Delegation + EURC (Circle stablecoin on Base) announced 2026 — neutralizes a USD-only objection from European builders',
    sourceUrl: 'https://nevermined.ai/blog',
  },
  {
    claim: 'Live virtual card issuance',
    cite:
      'Nevermined × Visa Intelligent Commerce + Coinbase x402 + VGS (April 9, 2026) — virtual cards for AI agents with budget/per-purchase/merchant/time guardrails',
    sourceUrl:
      'https://nevermined.ai/blog/nevermined-unlocks-autonomous-agent-card-payments-with-x402-opening-a-new-market-for-publishers-digital-merchants',
  },
]

export const settlegridStronger: Point[] = [
  {
    claim: `${SHIPPED_ADAPTERS.length} protocol adapters shipped in production code`,
    cite: `${SHIPPED_ADAPTERS.join(', ')} — apps/web/src/lib/settlement/adapters/`,
    sourceUrl: gh('apps/web/src/lib/settlement/adapters'),
  },
  {
    claim: 'True rail-neutrality in the detection chain',
    cite:
      'Every protocol is treated as a peer based on the incoming request signature — no default-chain bias — packages/mcp/src/adapters/',
    sourceUrl: gh('packages/mcp/src/adapters'),
  },
  {
    claim: 'Progressive 0% → 5% pricing (free below $1K/mo)',
    cite:
      'apps/web/src/app/pricing/page.tsx — materially better than a flat 2% at the long-tail end',
    sourceUrl: '/pricing',
  },
  {
    claim: `${TEMPLATE_COUNT} pre-wired open-source MCP server templates`,
    cite:
      'open-source-servers/ — distribution asset a competitor cannot easily replicate',
    sourceUrl: gh('open-source-servers'),
  },
  {
    claim: 'Multi-hop atomic settlement primitives',
    cite:
      'recordHop + finalizeSession + processSettlementBatch + rollbackSettlementBatch — apps/web/src/lib/settlement/sessions.ts — unique moat for multi-agent workflow billing',
    sourceUrl: gh('apps/web/src/lib/settlement/sessions.ts'),
  },
  {
    claim: 'Framework distribution breadth',
    cite:
      'create-settlegrid-tool CLI + @settlegrid/{ai-sdk, mastra, langchain, n8n, cursor} + settlegrid-mcpb — published to npm under the @settlegrid org',
    sourceUrl: 'https://www.npmjs.com/org/settlegrid',
  },
  {
    claim: 'Shipped compliance / identity / fraud / currency primitives',
    cite:
      'apps/web/src/lib/settlement/{compliance,identity,currency}.ts + apps/web/src/lib/fraud.ts — procurement-checkbox features',
    sourceUrl: gh('apps/web/src/lib/settlement'),
  },
  {
    claim: 'Asia-Pacific rail coverage (stubs, experimental)',
    cite:
      'alipay-proxy, kyapay-proxy, emvco-proxy, drain-proxy in apps/web/src/lib/ — scaffolding in place; functional status documented per file',
    sourceUrl: gh('apps/web/src/lib/alipay-proxy.ts'),
  },
]
