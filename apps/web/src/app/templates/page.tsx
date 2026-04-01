import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { ServerSearch } from '@/components/server-search'
import type { CatalogEntry } from '@/components/server-search'
import catalogData from '../../../public/server-catalog.json'

export const metadata: Metadata = {
  title: '1,000+ Open-Source MCP Templates | SettleGrid',
  description:
    'Browse 1,000+ open-source MCP server templates with SettleGrid billing pre-wired. Fork, customize, deploy, and start earning per-call revenue.',
  alternates: { canonical: 'https://settlegrid.ai/templates' },
  keywords: [
    'MCP server templates',
    'open source MCP',
    'AI tool templates',
    'SettleGrid billing',
    'Model Context Protocol',
    'AI monetization',
    'fork and deploy',
  ],
}

const servers = catalogData as CatalogEntry[]

export default function TemplatesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 px-6 py-16 pt-24">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-14">
            <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">
              Templates
            </p>
            <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-foreground mb-4">
              {servers.length.toLocaleString()} open-source templates
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Fork any template, deploy to Vercel, and start earning.
              SettleGrid billing is pre-wired in every one.
            </p>

            {/* Workflow */}
            <div className="mt-6 mx-auto max-w-xl rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-[#E5A336]">Fork</span>
              {' \u2192 '}
              <span className="font-medium text-[#E5A336]">Deploy</span>
              {' \u2192 '}
              <span className="font-medium text-[#E5A336]">Earn</span>
              {' — '}Your tool appears in the{' '}
              <Link href="/marketplace" className="text-[#E5A336] hover:underline">
                Marketplace
              </Link>{' '}
              and is discoverable by AI agents.
            </div>
          </div>

          {/* Search + Filter + Grid */}
          <ServerSearch servers={servers} />

          {/* Bottom CTA */}
          <div className="mt-16 rounded-lg border border-border bg-card p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground mb-3">
              Want to monetize your own tool?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Register for a free account, wrap your functions with the SDK, and
              start earning on every call.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/start"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
              >
                Start Building — Free
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
