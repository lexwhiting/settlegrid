/**
 * P2.MKT1 / P4.MKT3 — Counter-positioning page: SettleGrid vs Nevermined.
 *
 * Every claim on this page is anchored to one of:
 *   1. Shipped code in this repo (cited with a repo-relative path).
 *   2. A verifiable external URL (nevermined.ai, PyPI, GitHub).
 *
 * Source of truth for the positioning: `private/master-plan/competitive-positioning.md`.
 * Comparison data lives in `./data.ts` so the page never goes stale silently.
 * Two sections — "Where Nevermined is stronger" and "Where SettleGrid is stronger" —
 * are honest per that doc. If Nevermined lands a feature we claimed they
 * lacked, or SettleGrid's shipped claim regresses, update BOTH `./data.ts`
 * AND `competitive-positioning.md`.
 */

import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { isSafeSourceUrl } from './helpers'
import {
  dimensions,
  neverminedStronger,
  settlegridStronger,
  SHIPPED_ADAPTERS,
} from './data'

// `Intl.ListFormat` defaults to long-style conjunction in en-US, which
// includes the Oxford comma. Output for the canonical statement:
// "MCP, x402, AP2, ..., Mastercard VI, and Circle Nano". Computed once
// at module load.
const ADAPTER_LIST = new Intl.ListFormat('en').format(
  // ListFormat's TS lib types accept `Iterable<string>` in newer libs
  // and `string[]` in older ones; spreading produces a mutable copy
  // that satisfies both.
  [...SHIPPED_ADAPTERS],
)

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'SettleGrid vs. Nevermined: Honest Comparison',
  description: `An honest comparison of SettleGrid and Nevermined.ai across ${dimensions.length} dimensions: protocol breadth, default rail, pricing, SDKs, named customers, multi-hop settlement, framework distribution, geographic coverage, and compliance. Claims anchored to shipped code and public sources.`,
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
    title: 'SettleGrid vs. Nevermined: Honest Comparison',
    description: `${dimensions.length}-dimension comparison of SettleGrid and Nevermined.ai, anchored to shipped code and public sources.`,
    type: 'article',
    siteName: 'SettleGrid',
    url: 'https://settlegrid.ai/compare/nevermined',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SettleGrid vs. Nevermined: Honest Comparison',
    description: `${dimensions.length}-dimension comparison, anchored to shipped code and public sources.`,
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

// Breadcrumb is two items because there's no /compare index page in the
// app router (apps/web/src/app/compare/ has only nevermined/ as a child,
// not a page.tsx). Pointing position 2 at /compare would be a 404 to
// Google's structured-data crawler — so we go Home → leaf directly.
const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'SettleGrid vs. Nevermined',
      item: 'https://settlegrid.ai/compare/nevermined',
    },
  ],
}

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
  const wrapperClass = 'text-xs text-gray-500 mt-1 leading-relaxed'
  const linkClass =
    'text-gray-500 hover:text-gray-300 underline underline-offset-2 decoration-gray-700 hover:decoration-gray-400'
  if (!isSafeSourceUrl(sourceUrl)) {
    return <div className={wrapperClass}>{cite}</div>
  }
  // Internal route: exactly one leading slash, NOT `//…` (rejected by
  // isSafeSourceUrl above so only true internal routes reach here).
  if (sourceUrl.startsWith('/')) {
    return (
      <div className={wrapperClass}>
        <Link href={sourceUrl} className={linkClass}>
          {cite}
        </Link>
      </div>
    )
  }
  return (
    <div className={wrapperClass}>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
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
              USDC on Base. This page compares both across {dimensions.length} dimensions.
              Every claim is anchored to shipped code or a public URL. Where Nevermined
              is genuinely stronger, we say so.
            </p>
          </section>

          {/* ---- Side-by-side comparison table ---- */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">
              Side-by-side across {dimensions.length} dimensions
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
                aria-label={`SettleGrid versus Nevermined comparison across ${dimensions.length} dimensions`}
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
                  {isSafeSourceUrl(p.sourceUrl) ? (
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
                  {isSafeSourceUrl(p.sourceUrl) ? (
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
                across {SHIPPED_ADAPTERS.length} shipped protocol adapters &mdash;{' '}
                {ADAPTER_LIST} &mdash; so merchants accept whatever protocol the
                buyer arrives with. Settlement sessions support multi-hop atomic
                workflows, so Agent A paying Agent B paying Agent C commits or
                rolls back as one unit. Progressive pricing means developers keep
                100% of revenue under $1,000 per month and never cross 5% at scale.
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
              any MCP or AP2 tool. No credit card required.
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
              Last reviewed: 2026-05-01. If any claim about Nevermined on this
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
