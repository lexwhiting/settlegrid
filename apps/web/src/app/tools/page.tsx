'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'
import { Badge } from '@/components/ui/badge'

interface PublicTool {
  id: string
  name: string
  slug: string
  description: string
  developerName: string
  category: string
  averageRating: number
  reviewCount: number
  defaultCostCents: number
}

const CATEGORIES = [
  'All',
  'AI & ML',
  'Data & Analytics',
  'Developer Tools',
  'Finance',
  'Communication',
  'Productivity',
  'Security',
  'Infrastructure',
  'Content',
  'Other',
] as const

function formatCents(cents: number): string {
  return cents < 100
    ? `${cents}\u00A2`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

export default function MarketplacePage() {
  const [tools, setTools] = useState<PublicTool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('All')

  useEffect(() => {
    async function fetchTools() {
      try {
        const res = await fetch('/api/tools/public')
        if (!res.ok) {
          setError('Failed to load marketplace')
          return
        }
        const data = await res.json()
        setTools(data.data ?? [])
      } catch {
        setError('Network error loading marketplace')
      } finally {
        setLoading(false)
      }
    }
    fetchTools()
  }, [])

  const filtered = tools.filter((tool) => {
    const matchesSearch =
      !search ||
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase()) ||
      tool.developerName.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || tool.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm font-medium text-gray-600 hover:text-indigo transition-colors">
              Docs
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-indigo">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-indigo mb-3">Tool Marketplace</h1>
            <p className="text-lg text-gray-600">
              Discover and integrate monetized MCP tools built by the developer community.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <label htmlFor="marketplace-search" className="sr-only">Search tools</label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  id="marketplace-search"
                  type="text"
                  placeholder="Search tools by name, description, or developer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <label htmlFor="marketplace-category" className="sr-only">Filter by category</label>
              <select
                id="marketplace-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-6" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-6">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-40 mb-3" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-3" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-full mb-2" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">
                {search || category !== 'All'
                  ? 'No tools match your search. Try adjusting your filters.'
                  : 'No tools published yet. Be the first to list a tool!'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">{filtered.length} tool{filtered.length !== 1 ? 's' : ''} found</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/tools/${tool.slug}`}
                    className="group rounded-xl border border-gray-200 bg-white p-6 hover:border-brand/40 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg text-indigo group-hover:text-brand-text transition-colors">
                        {tool.name}
                      </h3>
                      <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">
                        {tool.category || 'Other'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      by {tool.developerName}
                    </p>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <StarRating rating={tool.averageRating ?? 0} />
                      <span className="text-sm font-semibold text-brand-text">
                        {formatCents(tool.defaultCostCents)}/call
                      </span>
                    </div>
                    {tool.reviewCount > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {tool.reviewCount} review{tool.reviewCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/tools" className="hover:text-indigo transition-colors">Marketplace</Link>
            <Link href="/docs" className="hover:text-indigo transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-indigo transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
