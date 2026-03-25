import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'
import { ShowcaseSearch } from '@/components/showcase-search'
import type { ShowcaseTool } from '@/components/showcase-search'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export default async function ShowcasePage() {
  let activeTools: ShowcaseTool[] = []

  try {
    const rows = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        tags: tools.tags,
        totalInvocations: tools.totalInvocations,
        currentVersion: tools.currentVersion,
        pricingConfig: tools.pricingConfig,
        verified: tools.verified,
        developerName: developers.name,
        developerSlug: developers.slug,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.status, 'active'))
      .orderBy(desc(tools.createdAt))

    activeTools = rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      description: r.description,
      category: r.category,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : null,
      totalInvocations: r.totalInvocations,
      currentVersion: r.currentVersion,
      pricingConfig: r.pricingConfig as ShowcaseTool['pricingConfig'],
      verified: r.verified,
      developerName: r.developerName,
      developerSlug: r.developerSlug ?? null,
    }))
  } catch {
    // DB unavailable — show empty state gracefully
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      <header className="border-b border-gray-200 dark:border-[#2E3148] px-6 py-4 dark:bg-[#1A1D2E]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/servers" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 transition-colors">
              Templates
            </Link>
            <Link href="/docs" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/learn" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/faq" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 transition-colors">
              FAQ
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Built on Settle<span className="text-emerald-400 font-normal">Grid</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              See what developers are building with SettleGrid&apos;s settlement layer.
            </p>
            <p className="text-sm text-gray-500 mt-3 max-w-2xl mx-auto">
              Tools appear here automatically when developers publish them. They&apos;re also indexed on the Official MCP Registry, Smithery, Glama, and 5+ directories via the{' '}
              <Link href="/docs#discovery" className="text-emerald-400 hover:underline">
                Discovery API
              </Link>
              .
            </p>
          </div>

          {/* Showcase: search + filter + featured + grid (client component) */}
          {activeTools.length > 0 ? (
            <ShowcaseSearch tools={activeTools} />
          ) : (
            <div className="rounded-xl border border-[#2E3148] bg-gradient-to-br from-[#1A1D2E] to-[#0F1117] p-10 mb-20">
              <div className="text-center mb-10">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-3">Be the first tool on SettleGrid</h2>
                <p className="text-gray-400 max-w-lg mx-auto">
                  The Showcase populates as developers publish tools. You could be earning in minutes.
                </p>
              </div>

              {/* Three paths */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="rounded-lg border border-[#2E3148] bg-[#1A1D2E]/60 p-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-100 mb-1">Scaffold in 30 seconds</h3>
                  <p className="text-xs text-gray-400 mb-3">Generate a complete MCP server with billing pre-wired. Choose from 4 templates and 3 deploy targets.</p>
                  <code className="block text-xs bg-[#252836] px-3 py-2 rounded font-mono text-emerald-400">npx create-settlegrid-tool</code>
                </div>

                <div className="rounded-lg border border-[#2E3148] bg-[#1A1D2E]/60 p-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-100 mb-1">Fork a template</h3>
                  <p className="text-xs text-gray-400 mb-3">1,017 open-source MCP server templates across 22 categories. Fork, add your API key, deploy.</p>
                  <Link href="/servers" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                    Browse templates &rarr;
                  </Link>
                </div>

                <div className="rounded-lg border border-[#2E3148] bg-[#1A1D2E]/60 p-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-100 mb-1">Follow the guide</h3>
                  <p className="text-xs text-gray-400 mb-3">Step-by-step handbook: pricing strategy, SDK integration, growth tactics, and revenue benchmarks.</p>
                  <Link href="/learn/handbook" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                    Read the handbook &rarr;
                  </Link>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
                >
                  Start Building — Free
                </Link>
                <p className="text-xs text-gray-500 mt-3">Free forever. 25,000 ops/month. 0% platform fee. No credit card.</p>
              </div>
            </div>
          )}

          {/* For developers callout */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-6 py-4 mb-10 text-center text-sm text-gray-400">
            Want your tool here?{' '}
            <Link href="/register" className="text-emerald-400 hover:underline font-medium">
              Get started free
            </Link>{' '}
            or read the{' '}
            <Link
              href="/learn/discovery"
              className="text-emerald-400 hover:underline font-medium"
            >
              Discovery Guide
            </Link>{' '}
            to maximize visibility.
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2E3148] bg-gradient-to-br from-[#1A1D2E] to-[#0F1117] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Ready to monetize your AI tools?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Add your tool to the SettleGrid showcase. Free forever for most developers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building — Free
              </Link>
              <Link
                href="/docs"
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2E3148] hover:border-gray-500 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-[#2E3148] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/tools" className="hover:text-indigo dark:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="hover:text-indigo dark:text-gray-100 transition-colors">Documentation</Link>
            <Link href="/learn" className="hover:text-indigo dark:text-gray-100 transition-colors">Learn</Link>
            <Link href="/faq" className="hover:text-indigo dark:text-gray-100 transition-colors">FAQ</Link>
            <Link href="/privacy" className="hover:text-indigo dark:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo dark:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
