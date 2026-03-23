import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export default async function ShowcasePage() {
  let activeTools: {
    name: string
    slug: string
    description: string | null
    category: string | null
    developerName: string | null
  }[] = []

  try {
    activeTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.status, 'active'))
      .orderBy(desc(tools.createdAt))
      .limit(20)
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
          </div>

          {/* Showcase Grid */}
          {activeTools.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
              {activeTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group rounded-xl border border-[#2E3148] bg-[#1A1D2E] p-6 hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors">
                      {tool.name}
                    </h3>
                    {tool.category && (
                      <span className="inline-flex items-center rounded-full bg-brand/10 text-brand-text px-2 py-0.5 text-xs font-semibold shrink-0 ml-2">
                        {tool.category}
                      </span>
                    )}
                  </div>
                  {tool.developerName && (
                    <p className="text-xs text-gray-500 mb-2">by {tool.developerName}</p>
                  )}
                  {tool.description && (
                    <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-2">
                      {tool.description.length > 100
                        ? `${tool.description.slice(0, 100)}...`
                        : tool.description}
                    </p>
                  )}
                  <div className="flex items-center justify-end pt-3 border-t border-[#252836]">
                    <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View storefront &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[#2E3148] bg-[#1A1D2E] p-12 text-center mb-20">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">The showcase is just getting started</h2>
              <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                Be the first to list your tool — it&apos;s free.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
              >
                List Your Tool
              </Link>
            </div>
          )}

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
          <SettleGridLogo variant="compact" size={24} />
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
