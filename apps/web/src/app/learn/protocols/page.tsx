import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Protocol Guides | SettleGrid',
  description:
    'Explore the 10 AI payment protocols supported by SettleGrid — MCP, MPP, x402, AP2, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nanopayments, and REST. One SDK, every protocol.',
  alternates: { canonical: 'https://settlegrid.ai/learn/protocols' },
  keywords: [
    'AI payment protocols',
    'MCP monetization',
    'x402 protocol',
    'AP2 Google',
    'Visa TAP',
    'AI agent payments',
    'SettleGrid protocols',
    'machine payments',
  ],
}

/* -------------------------------------------------------------------------- */
/*  Protocol card data                                                         */
/* -------------------------------------------------------------------------- */

interface ProtocolCard {
  slug: string
  name: string
  fullName: string
  backer: string
  status: 'Production' | 'Ready' | 'Testnet' | 'Pending'
  oneLiner: string
  color: string
  borderColor: string
}

const PROTOCOLS: ProtocolCard[] = [
  {
    slug: 'mcp',
    name: 'MCP',
    fullName: 'Model Context Protocol',
    backer: 'Anthropic',
    status: 'Production',
    oneLiner: 'The open standard for connecting AI assistants to external tools and data.',
    color: 'bg-orange-500/10 text-orange-400 hover:border-orange-500/40',
    borderColor: 'border-orange-800/30',
  },
  {
    slug: 'mpp',
    name: 'MPP',
    fullName: 'Machine Payments Protocol',
    backer: 'Stripe + Tempo',
    status: 'Production',
    oneLiner: 'Autonomous machine-to-machine payments backed by Stripe infrastructure.',
    color: 'bg-violet-500/10 text-violet-400 hover:border-violet-500/40',
    borderColor: 'border-violet-800/30',
  },
  {
    slug: 'x402',
    name: 'x402',
    fullName: 'HTTP 402 Payment Required',
    backer: 'Coinbase',
    status: 'Production',
    oneLiner: 'On-chain USDC payments via HTTP 402 for trustless machine commerce.',
    color: 'bg-blue-500/10 text-blue-400 hover:border-blue-500/40',
    borderColor: 'border-blue-800/30',
  },
  {
    slug: 'ap2',
    name: 'AP2',
    fullName: 'Agent Payments Protocol',
    backer: 'Google',
    status: 'Ready',
    oneLiner: 'Budget-capped credentials for AI agents in Google\'s partner ecosystem.',
    color: 'bg-green-500/10 text-green-400 hover:border-green-500/40',
    borderColor: 'border-green-800/30',
  },
  {
    slug: 'visa-tap',
    name: 'Visa TAP',
    fullName: 'Token Agent Payments',
    backer: 'Visa',
    status: 'Ready',
    oneLiner: 'Tokenized agent payments backed by Visa\'s global payment network.',
    color: 'bg-yellow-500/10 text-yellow-400 hover:border-yellow-500/40',
    borderColor: 'border-yellow-800/30',
  },
  {
    slug: 'ucp',
    name: 'UCP',
    fullName: 'Universal Commerce Protocol',
    backer: 'Google + Shopify',
    status: 'Ready',
    oneLiner: 'Universal checkout for AI agents — discover, negotiate, and purchase services.',
    color: 'bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/40',
    borderColor: 'border-emerald-800/30',
  },
  {
    slug: 'acp',
    name: 'ACP',
    fullName: 'Agentic Commerce Protocol',
    backer: 'OpenAI + Stripe',
    status: 'Ready',
    oneLiner: 'Seamless agent-to-service commerce powered by OpenAI and Stripe.',
    color: 'bg-teal-500/10 text-teal-400 hover:border-teal-500/40',
    borderColor: 'border-teal-800/30',
  },
  {
    slug: 'mastercard-agent-pay',
    name: 'Mastercard Agent Pay',
    fullName: 'Mastercard Agent Pay',
    backer: 'Mastercard',
    status: 'Pending',
    oneLiner: 'Verified intent-based payments preventing unauthorized agent spending.',
    color: 'bg-red-500/10 text-red-400 hover:border-red-500/40',
    borderColor: 'border-red-800/30',
  },
  {
    slug: 'circle-nanopayments',
    name: 'Circle Nanopayments',
    fullName: 'Circle Nanopayments',
    backer: 'Circle (USDC)',
    status: 'Testnet',
    oneLiner: 'Sub-cent USDC micropayments via payment channels for AI workloads.',
    color: 'bg-sky-500/10 text-sky-400 hover:border-sky-500/40',
    borderColor: 'border-sky-800/30',
  },
  {
    slug: 'rest',
    name: 'REST',
    fullName: 'REST API (Any HTTP Service)',
    backer: 'Any HTTP API',
    status: 'Production',
    oneLiner: 'Per-call billing for any HTTP endpoint — Express, Next.js, Fastify, and more.',
    color: 'bg-gray-500/10 text-gray-400 hover:border-gray-500/40',
    borderColor: 'border-gray-700/50',
  },
]

/* -------------------------------------------------------------------------- */
/*  Status badge                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: ProtocolCard['status'] }) {
  const styles: Record<ProtocolCard['status'], string> = {
    Production: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Ready: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Testnet: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Pending: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                             */
/* -------------------------------------------------------------------------- */

export default function ProtocolIndexPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#1A1D2E]">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* ---- Main content ---- */}
      <main className="flex-1 px-6 py-16">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Link href="/learn" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
              &larr; Learn Hub
            </Link>
          </div>

          {/* Title */}
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-emerald-400 tracking-wide uppercase mb-2">Protocol Guides</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              One SDK. Ten Protocols. Zero Vendor Lock-in.
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              SettleGrid supports every major AI payment protocol out of the box. Wrap your tool once and
              accept payments from agents across Anthropic, Google, Stripe, Visa, Mastercard, Coinbase,
              OpenAI, Circle, and Shopify ecosystems.
            </p>
          </div>

          {/* Protocol grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROTOCOLS.map((proto) => (
              <Link
                key={proto.slug}
                href={`/learn/protocols/${proto.slug}`}
                className={`group rounded-xl border ${proto.borderColor} ${proto.color} p-5 transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold">{proto.name}</h2>
                  <StatusBadge status={proto.status} />
                </div>
                <p className="text-xs font-semibold opacity-70 mb-2">{proto.backer}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{proto.oneLiner}</p>
                <div className="mt-4 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400">
                  Read guide &rarr;
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16">
            <p className="text-gray-500 mb-4">
              All protocols use the same <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-sm">sg.wrap()</code> interface.
              No protocol-specific code required.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors"
            >
              Start Building Free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2E3148] px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            <SettleGridLogo variant="compact" size={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-gray-300 transition-colors">Docs</Link>
            <Link href="/learn" className="hover:text-gray-300 transition-colors">Learn</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
