import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { Badge } from '@/components/ui/badge'
import { getAllShadowEntries, countShadowEntries } from '@/lib/shadow-index'

export const dynamic = 'force-static'
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'MCP Server Directory | SettleGrid',
  description:
    'Browse thousands of MCP servers from GitHub, npm, PyPI, and more. Add per-call billing with one command.',
  alternates: { canonical: 'https://settlegrid.ai/mcp' },
}

export default async function McpDirectoryPage() {
  const [entries, totalCount] = await Promise.all([
    getAllShadowEntries(50),
    countShadowEntries(),
  ])

  // Group top 50 by category for navigation
  const byCategory = new Map<string, typeof entries>()
  for (const e of entries) {
    const cat = e.category ?? 'other'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(e)
  }
  const categories = [...byCategory.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 px-6 py-16 pt-24">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-14">
            <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">
              MCP Directory
            </p>
            <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-foreground mb-4">
              {totalCount > 0
                ? `${totalCount.toLocaleString()} MCP servers`
                : 'MCP Server Directory'}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every MCP server on the web — from GitHub, npm, PyPI, Smithery,
              and more. Add per-call billing with one command.
            </p>
          </div>

          {/* Category nav */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-8">
              {categories.map(([cat, items]) => (
                <Badge key={cat} variant="secondary">
                  {cat} ({items.length})
                </Badge>
              ))}
            </div>
          )}

          {/* Top 50 by stars */}
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Top by Stars
          </h2>
          {entries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {entries.map((e) => (
                <Link
                  key={`${e.source}-${e.owner}-${e.repo}`}
                  href={`/mcp/${e.owner}/${e.repo}`}
                  className="group block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-[#E5A336]/40 dark:border-[#2A2D3E] dark:bg-[#161822] dark:hover:border-[#E5A336]/40"
                >
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#E5A336] transition-colors line-clamp-1 mb-1">
                    {e.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {e.owner}/{e.repo}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {e.description ?? 'MCP server'}
                  </p>
                  <div className="flex items-center gap-2">
                    {e.stars != null && (
                      <span className="text-xs text-muted-foreground">
                        {e.stars.toLocaleString()} stars
                      </span>
                    )}
                    {e.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {e.category}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground mb-12">
              The shadow directory is being populated. Run the crawler to seed data.
            </div>
          )}

          {/* Link to full search */}
          <div className="text-center">
            <Link
              href="/templates"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
            >
              Browse Polished Templates
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
