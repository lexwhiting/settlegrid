import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'GitHub App Integration — Auto-List Your MCP Tools | SettleGrid',
  description:
    'Install the SettleGrid GitHub App to automatically discover, list, and sync MCP tools from your repositories. Push code, get listed, start earning.',
  alternates: { canonical: 'https://settlegrid.ai/learn/github-app' },
  keywords: [
    'SettleGrid GitHub integration',
    'GitHub App MCP tools',
    'auto-list MCP server',
    'GitHub MCP monetization',
    'SettleGrid auto-discover tools',
  ],
  openGraph: {
    title: 'GitHub App Integration | SettleGrid',
    description:
      'Install the SettleGrid GitHub App to auto-discover and list MCP servers from your repositories.',
    type: 'website',
    url: 'https://settlegrid.ai/learn/github-app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitHub App Integration | SettleGrid',
    description:
      'Install the SettleGrid GitHub App to auto-discover and list MCP servers from your repositories.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Learn', item: 'https://settlegrid.ai/learn' },
    { '@type': 'ListItem', position: 2, name: 'GitHub App', item: 'https://settlegrid.ai/learn/github-app' },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function GitHubAppPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">GitHub App</span>
          </nav>

          {/* Hero */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                Zero code
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              SettleGrid GitHub App
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
              Install the GitHub App on your organization or personal account. SettleGrid automatically watches your repositories for <code className="bg-[#161822] border border-[#2A2D3E] px-1.5 py-0.5 rounded text-sm text-amber-400">@settlegrid/mcp</code> usage, creates listings, and syncs metadata. No code changes needed.
            </p>
          </div>

          {/* What it does */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">What It Does</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Auto-Discovery',
                  description: 'Scans your repositories for @settlegrid/mcp imports and package.json dependencies.',
                },
                {
                  title: 'Auto-Listing',
                  description: 'Creates tool listings on SettleGrid automatically when it finds MCP server code in your repos.',
                },
                {
                  title: 'Metadata Sync',
                  description: 'Keeps your tool name, description, and version in sync with your repository as you push updates.',
                },
                {
                  title: 'Push Notifications',
                  description: 'You get notified when new tools are discovered and listed, so you can review and set pricing.',
                },
              ].map((item) => (
                <div key={item.title} className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
                  <h3 className="font-semibold text-gray-100 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How to install */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">How to Install</h2>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <ol className="space-y-6">
                <li className="flex items-start gap-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 font-bold text-sm shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-gray-100 mb-1">Visit the GitHub App page</p>
                    <a
                      href="https://github.com/apps/settlegrid"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      github.com/apps/settlegrid
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 font-bold text-sm shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-gray-100 mb-1">Click &quot;Install&quot;</p>
                    <p className="text-sm text-gray-400">Choose your organization or personal account, then select which repositories to grant access to (all repos or select repos).</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 font-bold text-sm shrink-0">3</span>
                  <div>
                    <p className="font-semibold text-gray-100 mb-1">Done</p>
                    <p className="text-sm text-gray-400">That is it. No code changes, no configuration files, no webhooks to set up. SettleGrid handles everything.</p>
                  </div>
                </li>
              </ol>
            </div>
          </section>

          {/* What happens after install */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">What Happens After Install</h2>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0" aria-hidden="true">&#10003;</span>
                <p className="text-sm text-gray-400"><strong className="text-gray-300">Immediate scan</strong> — Your selected repositories are scanned for <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">@settlegrid/mcp</code> imports, package.json entries, and MCP server configurations.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0" aria-hidden="true">&#10003;</span>
                <p className="text-sm text-gray-400"><strong className="text-gray-300">Auto-listing</strong> — Tools found in your repos are automatically created as draft listings on SettleGrid. You can review, set pricing, and activate them from your dashboard.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0" aria-hidden="true">&#10003;</span>
                <p className="text-sm text-gray-400"><strong className="text-gray-300">Ongoing sync</strong> — Every push to your default branch triggers a re-scan. New tools are discovered, existing listings are updated with the latest metadata.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0" aria-hidden="true">&#10003;</span>
                <p className="text-sm text-gray-400"><strong className="text-gray-300">Notification</strong> — You receive an email whenever a new tool is discovered in your repos, with a link to review and publish it.</p>
              </div>
            </div>
          </section>

          {/* No code needed callout */}
          <section className="mb-12">
            <div className="bg-gradient-to-br from-amber-500/5 via-transparent to-transparent border border-amber-500/20 rounded-xl p-6 text-center">
              <p className="text-lg font-semibold text-gray-100 mb-2">No code changes required</p>
              <p className="text-sm text-gray-400 max-w-lg mx-auto">
                If you already use <code className="bg-[#161822] border border-[#2A2D3E] px-1 py-0.5 rounded text-xs">@settlegrid/mcp</code> in your projects, just install the GitHub App. Your tools are discovered, listed, and kept in sync automatically.
              </p>
            </div>
          </section>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">Ready to connect your repos?</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Install the GitHub App and start auto-listing your MCP tools in under a minute.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://github.com/apps/settlegrid"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Install GitHub App
              </a>
              <Link
                href="/docs"
                className="inline-flex items-center border border-[#2A2D3E] text-gray-300 px-6 py-3 rounded-lg font-medium hover:border-gray-400 hover:text-gray-100 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6 mt-16">
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
