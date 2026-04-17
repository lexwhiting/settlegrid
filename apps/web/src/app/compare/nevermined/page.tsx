/**
 * P2.MKT1 — Counter-positioning page: SettleGrid vs Nevermined.
 *
 * Every claim on this page is anchored to one of:
 *   1. Shipped code in this repo (cited with a repo-relative path).
 *   2. A verifiable external URL (nevermined.ai, PyPI, GitHub).
 *
 * Source of truth for the positioning: `private/master-plan/competitive-positioning.md`.
 * Two sections — "Where Nevermined is stronger" and "Where SettleGrid
 * is stronger" — are honest per that doc. If Nevermined lands a
 * feature we claimed they lacked, or SettleGrid's shipped claim
 * regresses, update BOTH this page AND competitive-positioning.md.
 */

import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'SettleGrid vs Nevermined — honest side-by-side comparison',
  description:
    'An honest comparison of SettleGrid and Nevermined.ai across nine dimensions: protocol breadth, default rail, pricing, SDKs, named customers, multi-hop settlement, framework distribution, geographic coverage, and compliance. Claims anchored to shipped code and public sources.',
  alternates: { canonical: 'https://settlegrid.ai/compare/nevermined' },
  keywords: [
    'SettleGrid vs Nevermined',
    'Nevermined comparison',
    'AI agent payments comparison',
    'agentic commerce settlement',
    'x402 settlement layer',
    'multi-protocol AI billing',
    'AI tool monetization',
  ],
  openGraph: {
    title: 'SettleGrid vs Nevermined — honest side-by-side comparison',
    description:
      'Nine-dimension comparison of SettleGrid and Nevermined.ai, anchored to shipped code and public sources.',
    type: 'article',
    siteName: 'SettleGrid',
    url: 'https://settlegrid.ai/compare/nevermined',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SettleGrid vs Nevermined — honest side-by-side comparison',
    description:
      'Nine-dimension comparison, anchored to shipped code and public sources.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
    { '@type': 'ListItem', position: 2, name: 'Compare', item: 'https://settlegrid.ai/compare' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Nevermined',
      item: 'https://settlegrid.ai/compare/nevermined',
    },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Comparison data                                                            */
/*                                                                             */
/*  Every cell carries a `cite` note that lets a reader (or a fact-            */
/*  check agent) trace the claim to either shipped code or a public URL.       */
/* -------------------------------------------------------------------------- */

type Cell = {
  value: string
  cite: string
  /**
   * One-click verification link. For shipped-code citations: a GitHub
   * link to the file or directory on `main`. For external claims: the
   * upstream URL. When absent, the cite text is non-clickable (use
   * only for narrative notes that have no single source URL).
   */
  sourceUrl?: string
}

type Dimension = {
  label: string
  settlegrid: Cell
  nevermined: Cell
}

// Canonical base for shipped-code citations. Rendering a bare path as
// a link against this root lets a reader click through to the exact
// file/directory on the default branch — honoring the spec's
// "anchor every claim with shipped-code citations" requirement.
const GH_BASE = 'https://github.com/lexwhiting/settlegrid/tree/main'
const gh = (path: string) => `${GH_BASE}/${path.replace(/^\/+/, '')}`

const dimensions: Dimension[] = [
  {
    label: 'Protocol breadth',
    settlegrid: {
      value: '9 shipped adapters',
      cite: 'MCP, x402, AP2, MPP, ACP, UCP, Visa TAP, Mastercard VI, Circle Nano — apps/web/src/lib/settlement/adapters/',
      sourceUrl: gh('apps/web/src/lib/settlement/adapters'),
    },
    nevermined: {
      value: '3 production + 1 demo',
      cite:
        'x402 (primary, production), MCP, A2A extension + AP2 (Jan 2026 demo on Base Sepolia testnet)',
      sourceUrl: 'https://docs.nevermined.io',
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
      sourceUrl: 'https://docs.nevermined.io',
    },
  },
  {
    label: 'Take rate',
    settlegrid: {
      value: '0% → 5% progressive',
      cite:
        '0% on first $1K/mo, 2% $1K–$10K, 3% $10K–$50K, 5% $50K+ — apps/web/src/app/pricing/page.tsx',
      sourceUrl: '/pricing',
    },
    nevermined: {
      value: '2% flat (+ Stripe fees on fiat)',
      cite: 'Public pricing page',
      sourceUrl: 'https://nevermined.io/pricing',
    },
  },
  {
    label: 'SDK languages',
    settlegrid: {
      value: 'TypeScript (Python planned)',
      cite:
        '@settlegrid/mcp + ai-sdk + mastra + langchain + n8n + cursor on npm; no Python SDK yet',
      sourceUrl: 'https://www.npmjs.com/org/settlegrid',
    },
    nevermined: {
      value: 'TypeScript + Python',
      cite: 'payments (TS) and payments-py (Python)',
      sourceUrl: 'https://github.com/nevermined-io',
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
      sourceUrl: 'https://nevermined.io',
    },
  },
  {
    label: 'Multi-hop settlement primitives',
    settlegrid: {
      value:
        'Atomic commit/rollback across agent chains',
      cite:
        'recordHop, finalizeSession, processSettlementBatch, rollbackSettlementBatch — apps/web/src/lib/settlement/sessions.ts',
      sourceUrl: gh('apps/web/src/lib/settlement/sessions.ts'),
    },
    nevermined: {
      value: 'Not documented as a shipped primitive',
      cite: 'No equivalent in public Nevermined docs as of 2026-04-17',
      sourceUrl: 'https://docs.nevermined.io',
    },
  },
  {
    label: 'Framework distribution',
    settlegrid: {
      value: 'CLI + 5 adapter packages + 1,022 templates',
      cite:
        'create-settlegrid-tool, @settlegrid/{ai-sdk,mastra,langchain,n8n,cursor}, settlegrid-mcpb + open-source-servers/ (1,022 templates)',
      sourceUrl: gh('packages'),
    },
    nevermined: {
      value: 'SDKs only (TS + Python)',
      cite: 'No CLI, no framework adapter packages, no template catalog per public docs',
      sourceUrl: 'https://docs.nevermined.io',
    },
  },
  {
    label: 'Geographic coverage',
    settlegrid: {
      value: 'Stripe Connect + Asia-Pacific rail stubs',
      cite:
        'alipay-proxy, kyapay-proxy, emvco-proxy, drain-proxy stubs — apps/web/src/lib/settlement/adapters/ (experimental status documented)',
      sourceUrl: gh('apps/web/src/lib/settlement/adapters'),
    },
    nevermined: {
      value: 'Stripe Connect + EUR/EURC',
      cite: 'EUR/EURC announced March 2026',
      sourceUrl: 'https://nevermined.io/blog',
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
      sourceUrl: 'https://docs.nevermined.io',
    },
  },
]

/* -------------------------------------------------------------------------- */
/*  "Where X is stronger" data                                                 */
/* -------------------------------------------------------------------------- */

type Point = {
  claim: string
  cite: string
  sourceUrl?: string
}

const neverminedStronger: Point[] = [
  {
    claim: 'Named reference customer',
    cite: 'Valory/Olas (investor-customer) — still a procurement signal SettleGrid has not yet matched',
    sourceUrl: 'https://nevermined.io',
  },
  {
    claim: 'Python SDK parity',
    cite: 'payments-py on PyPI. SettleGrid ships TypeScript only today.',
    sourceUrl: 'https://pypi.org/project/payments-py/',
  },
  {
    claim: 'Brand and SEO head start',
    cite:
      '~30 blog posts ranking for "AI agent payments" and "agentic commerce" since early 2025',
    sourceUrl: 'https://nevermined.io/blog',
  },
  {
    claim: 'Public funding signal',
    cite:
      '$4M seed January 2025 (Generative Ventures lead; NEAR, Polymorphic, Halo participating) — creates procurement credibility',
  },
  {
    claim: '"PayPal for AI" narrative',
    cite:
      'A sticky consumer metaphor that buyers grasp in one sentence — SettleGrid\'s "settlement layer" framing is more precise but less story-shaped',
  },
  {
    claim: 'EUR/EURC multi-currency',
    cite: 'Announced March 2026',
    sourceUrl: 'https://nevermined.io/blog',
  },
  {
    claim: 'Public x402 facilitator as a network service',
    cite: 'Operates a hosted x402 facilitator — SettleGrid currently ships adapter code but not a hosted facilitator',
    sourceUrl: 'https://docs.nevermined.io',
  },
  {
    claim: 'Live virtual card issuance',
    cite: 'Nevermined Pay (Visa / VGS integration, April 2026) — virtual cards with spending rules',
    sourceUrl: 'https://nevermined.io',
  },
]

const settlegridStronger: Point[] = [
  {
    claim: '9 protocol adapters shipped in production code',
    cite:
      'MCP, x402, AP2, MPP, ACP, UCP, Visa TAP, Mastercard VI, Circle Nano — apps/web/src/lib/settlement/adapters/',
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
    claim: '1,022 pre-wired open-source MCP server templates',
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
      'alipay-proxy, kyapay-proxy, emvco-proxy, drain-proxy — scaffolding in place; functional status documented per adapter',
    sourceUrl: gh('apps/web/src/lib/settlement/adapters'),
  },
]

/* -------------------------------------------------------------------------- */
/*  Renderers                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Render a citation as a clickable link when a sourceUrl is present,
 * plain text otherwise. Keeps every verifiable claim one click away
 * from its source — shipped-code citations link to GitHub on `main`,
 * external citations link to the upstream URL.
 *
 * Internal routes (starting with `/`) use Next.js <Link>; external
 * URLs open in a new tab with rel="noopener noreferrer".
 */
function Cite({ cite, sourceUrl }: { cite: string; sourceUrl?: string }) {
  if (!sourceUrl) {
    return (
      <div className="text-xs text-gray-500 mt-1 leading-relaxed">{cite}</div>
    )
  }
  const isInternal = sourceUrl.startsWith('/')
  if (isInternal) {
    return (
      <div className="text-xs text-gray-500 mt-1 leading-relaxed">
        <Link
          href={sourceUrl}
          className="text-gray-500 hover:text-gray-300 underline underline-offset-2 decoration-gray-700 hover:decoration-gray-400"
        >
          {cite}
        </Link>
      </div>
    )
  }
  return (
    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-gray-300 underline underline-offset-2 decoration-gray-700 hover:decoration-gray-400"
      >
        {cite}
      </a>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CompareNeverminedPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />

      <Navbar />

      <main className="flex-1 px-6 py-16 pt-14">
        <div className="max-w-5xl mx-auto">
          {/* ---- Eyebrow + Hero ---- */}
          <section className="mb-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-4">
              Comparison
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-6 leading-tight">
              SettleGrid vs Nevermined — honest side-by-side
            </h1>
            <p className="text-xl text-gray-400 leading-relaxed max-w-3xl">
              SettleGrid is the <strong className="text-gray-200">rail-neutral,
              protocol-neutral settlement layer for the long tail of AI tools</strong>.
              Nevermined is a crypto-first agent payments platform that defaults to
              USDC on Base. This page compares both across nine dimensions. Every
              claim is anchored to shipped code or a public URL. Where Nevermined is
              genuinely stronger, we say so.
            </p>
          </section>

          {/* ---- Side-by-side comparison table ---- */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">
              Side-by-side across nine dimensions
            </h2>
            <p className="text-sm text-gray-400 mb-8">
              Claims sourced from{' '}
              <Link
                href="https://nevermined.ai"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                nevermined.ai
              </Link>{' '}
              (public docs + blog) and from this repo&apos;s shipped code.
            </p>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table
                className="w-full text-sm border border-[#2A2D3E] rounded-xl overflow-hidden"
                aria-label="SettleGrid versus Nevermined comparison across nine dimensions"
              >
                <caption className="sr-only">
                  Side-by-side comparison of SettleGrid and Nevermined across
                  protocol breadth, default rail, take rate, SDK languages,
                  named customers, multi-hop settlement primitives, framework
                  distribution, geographic coverage, and compliance posture.
                </caption>
                <thead className="bg-[#161822]">
                  <tr>
                    <th scope="col" className="text-left font-semibold text-gray-300 px-5 py-4 border-b border-[#2A2D3E] w-1/4">
                      Dimension
                    </th>
                    <th scope="col" className="text-left font-semibold text-amber-400 px-5 py-4 border-b border-[#2A2D3E]">
                      SettleGrid
                    </th>
                    <th scope="col" className="text-left font-semibold text-gray-300 px-5 py-4 border-b border-[#2A2D3E]">
                      Nevermined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dimensions.map((d, i) => (
                    <tr
                      key={d.label}
                      className={i % 2 === 0 ? 'bg-[#0C0E14]' : 'bg-[#11131B]'}
                    >
                      <th
                        scope="row"
                        className="text-left align-top px-5 py-4 font-medium text-gray-300 border-b border-[#2A2D3E]"
                      >
                        {d.label}
                      </th>
                      <td className="align-top px-5 py-4 border-b border-[#2A2D3E]">
                        <div className="font-medium text-gray-100">
                          {d.settlegrid.value}
                        </div>
                        <Cite
                          cite={d.settlegrid.cite}
                          sourceUrl={d.settlegrid.sourceUrl}
                        />
                      </td>
                      <td className="align-top px-5 py-4 border-b border-[#2A2D3E]">
                        <div className="font-medium text-gray-100">
                          {d.nevermined.value}
                        </div>
                        <Cite
                          cite={d.nevermined.cite}
                          sourceUrl={d.nevermined.sourceUrl}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards */}
            <div className="md:hidden space-y-4">
              {dimensions.map((d) => (
                <div
                  key={d.label}
                  className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5"
                >
                  <div className="text-sm font-semibold text-gray-300 mb-3">
                    {d.label}
                  </div>
                  <div className="mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
                      SettleGrid
                    </div>
                    <div className="text-sm text-gray-100">{d.settlegrid.value}</div>
                    <Cite
                      cite={d.settlegrid.cite}
                      sourceUrl={d.settlegrid.sourceUrl}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                      Nevermined
                    </div>
                    <div className="text-sm text-gray-100">{d.nevermined.value}</div>
                    <Cite
                      cite={d.nevermined.cite}
                      sourceUrl={d.nevermined.sourceUrl}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Where Nevermined is stronger ---- */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              Where Nevermined is genuinely stronger
            </h2>
            <p className="text-sm text-gray-400 mb-6 max-w-3xl">
              If these dimensions are load-bearing for your use case, pick
              Nevermined. We would rather you make the right call than ship with
              the wrong tool.
            </p>
            <ul className="space-y-4">
              {neverminedStronger.map((p) => (
                <li
                  key={p.claim}
                  className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5"
                >
                  <div className="font-semibold text-gray-100 mb-1">{p.claim}</div>
                  {p.sourceUrl ? (
                    p.sourceUrl.startsWith('/') ? (
                      <Link
                        href={p.sourceUrl}
                        className="text-sm text-gray-400 hover:text-gray-300 leading-relaxed underline underline-offset-2 decoration-gray-700 hover:decoration-gray-400"
                      >
                        {p.cite}
                      </Link>
                    ) : (
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-400 hover:text-gray-300 leading-relaxed underline underline-offset-2 decoration-gray-700 hover:decoration-gray-400"
                      >
                        {p.cite}
                      </a>
                    )
                  ) : (
                    <div className="text-sm text-gray-400 leading-relaxed">{p.cite}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ---- Where SettleGrid is stronger ---- */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              Where SettleGrid is genuinely stronger
            </h2>
            <p className="text-sm text-gray-400 mb-6 max-w-3xl">
              Every bullet here is anchored to a file or npm package you can
              inspect. If any claim regresses, open an issue and we will fix
              both the code and this page.
            </p>
            <ul className="space-y-4">
              {settlegridStronger.map((p) => (
                <li
                  key={p.claim}
                  className="bg-[#161822] border border-amber-500/40 rounded-xl p-5"
                >
                  <div className="font-semibold text-amber-300 mb-1">{p.claim}</div>
                  {p.sourceUrl ? (
                    p.sourceUrl.startsWith('/') ? (
                      <Link
                        href={p.sourceUrl}
                        className="text-sm text-gray-400 hover:text-gray-300 leading-relaxed underline underline-offset-2 decoration-gray-700 hover:decoration-gray-400"
                      >
                        {p.cite}
                      </Link>
                    ) : (
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-400 hover:text-gray-300 leading-relaxed underline underline-offset-2 decoration-gray-700 hover:decoration-gray-400"
                      >
                        {p.cite}
                      </a>
                    )
                  ) : (
                    <div className="text-sm text-gray-400 leading-relaxed">{p.cite}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ---- Canonical differentiation statement ---- */}
          <section className="mb-20">
            <div className="bg-gradient-to-br from-[#161822] to-[#0C0E14] border border-[#2A2D3E] rounded-xl p-8 md:p-10">
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-4">
                The positioning, in one paragraph
              </p>
              <p className="text-lg text-gray-200 leading-relaxed">
                SettleGrid is the rail-neutral, protocol-neutral settlement layer
                for the long tail of AI tools. Unlike crypto-first agent payment
                platforms that default to USDC on a specific chain, SettleGrid
                routes every incoming request through a runtime detection chain
                across nine shipped protocol adapters &mdash; MCP, x402, AP2, MPP,
                ACP, UCP, Visa TAP, Mastercard VI, and Circle Nano &mdash; so
                merchants accept whatever protocol the buyer arrives with.
                Settlement sessions support multi-hop atomic workflows, so Agent A
                paying Agent B paying Agent C commits or rolls back as one unit.
                Progressive pricing means developers keep 100% of revenue under
                $1,000 per month and never cross 5% at scale.
              </p>
            </div>
          </section>

          {/* ---- CTA ---- */}
          <section className="bg-gradient-to-br from-[#161822] to-[#0C0E14] border border-[#2A2D3E] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-100 mb-4">
              Start with SettleGrid
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Free forever under $1,000/month. Two lines of code to start billing
              any MCP, x402, or AP2 tool. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg hover:bg-brand-dark transition-colors"
              >
                Start with SettleGrid
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center border border-[#2A2D3E] text-gray-300 font-medium px-8 py-3 rounded-lg hover:border-gray-400 hover:text-gray-100 transition-colors"
              >
                See the pricing
              </Link>
            </div>
          </section>

          {/* ---- Footnote / update policy ---- */}
          <section className="mt-16 text-xs text-gray-500 leading-relaxed">
            <p>
              Last reviewed: 2026-04-17. If any claim about Nevermined on this
              page is out of date or inaccurate, email{' '}
              <Link
                href="mailto:support@settlegrid.ai"
                className="text-gray-400 hover:text-gray-300 underline underline-offset-2"
              >
                support@settlegrid.ai
              </Link>{' '}
              and we will correct it and credit the correction. Positioning
              source of truth:{' '}
              <span className="text-gray-400">competitive-positioning.md</span>{' '}
              (internal, reviewed on the same cadence).
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
