'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { cn } from '@/lib/utils'

/* ─── Type tabs ─────────────────────────────────────────────────────────────── */

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'mcp-server', label: 'MCP Servers' },
  { value: 'ai-model', label: 'AI Models' },
  { value: 'rest-api', label: 'APIs' },
  { value: 'agent-tool', label: 'Agent Tools' },
  { value: 'sdk-package', label: 'Packages' },
  { value: 'automation', label: 'Automations' },
  { value: 'dataset', label: 'Datasets' },
  { value: 'extension', label: 'Extensions' },
] as const

const CATEGORIES = [
  'data',
  'nlp',
  'image',
  'code',
  'search',
  'finance',
  'productivity',
  'analytics',
  'security',
  'other',
] as const

const ECOSYSTEMS = [
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'npm', label: 'npm' },
  { value: 'pypi', label: 'PyPI' },
  { value: 'smithery', label: 'Smithery' },
  { value: 'apify', label: 'Apify' },
  { value: 'mcp-registry', label: 'MCP Registry' },
  { value: 'pulsemcp', label: 'PulseMCP' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'github', label: 'GitHub' },
] as const

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'revenue', label: 'Highest Revenue' },
] as const

interface MarketplaceFiltersProps {
  activeType?: string
  showTypeTabs?: boolean
}

export function MarketplaceFilters({ activeType, showTypeTabs = true }: MarketplaceFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentType = activeType ?? searchParams.get('type') ?? ''
  const currentCategory = searchParams.get('category') ?? ''
  const currentEcosystem = searchParams.get('ecosystem') ?? ''
  const currentSort = searchParams.get('sort') ?? 'popular'
  const currentSearch = searchParams.get('q') ?? ''

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      // Reset to page 1 when filters change
      params.delete('page')
      startTransition(() => {
        router.push(`/marketplace?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  return (
    <div className={cn('transition-opacity', isPending && 'opacity-60')}>
      {/* Type Tabs */}
      {showTypeTabs && (
        <div className="flex flex-wrap gap-2 mb-8">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => updateParams({ type: tab.value })}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentType === tab.value
                  ? 'bg-brand text-white shadow-sm shadow-brand/25'
                  : 'bg-[#161822] text-gray-400 border border-[#2A2D3E] hover:border-amber-500/40 hover:text-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters Row */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* Sidebar Filters */}
        <div className="lg:w-64 shrink-0 space-y-6">
          {/* Search */}
          <div>
            <label htmlFor="marketplace-search" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Search
            </label>
            <input
              id="marketplace-search"
              type="text"
              placeholder="Search tools..."
              defaultValue={currentSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateParams({ q: (e.target as HTMLInputElement).value })
                }
              }}
              className="w-full bg-[#161822] border border-[#2A2D3E] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Category
            </label>
            <div className="space-y-1">
              <button
                onClick={() => updateParams({ category: '' })}
                className={cn(
                  'block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                  !currentCategory
                    ? 'bg-amber-500/10 text-amber-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E2130]'
                )}
              >
                All Categories
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => updateParams({ category: currentCategory === cat ? '' : cat })}
                  className={cn(
                    'block w-full text-left px-3 py-1.5 rounded-md text-sm capitalize transition-colors',
                    currentCategory === cat
                      ? 'bg-amber-500/10 text-amber-400 font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E2130]'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Ecosystem Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Ecosystem
            </label>
            <div className="space-y-1">
              <button
                onClick={() => updateParams({ ecosystem: '' })}
                className={cn(
                  'block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                  !currentEcosystem
                    ? 'bg-amber-500/10 text-amber-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E2130]'
                )}
              >
                All Ecosystems
              </button>
              {ECOSYSTEMS.map((eco) => (
                <button
                  key={eco.value}
                  onClick={() =>
                    updateParams({ ecosystem: currentEcosystem === eco.value ? '' : eco.value })
                  }
                  className={cn(
                    'block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                    currentEcosystem === eco.value
                      ? 'bg-amber-500/10 text-amber-400 font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E2130]'
                  )}
                >
                  {eco.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label htmlFor="marketplace-sort" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Sort By
            </label>
            <select
              id="marketplace-sort"
              value={currentSort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="w-full bg-[#161822] border border-[#2A2D3E] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500/50 transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Placeholder for the grid — children will be passed separately */}
        {/* This component only handles the filters; the grid is rendered by the page */}
      </div>
    </div>
  )
}

/* ─── Pagination ────────────────────────────────────────────────────────────── */

interface PaginationProps {
  page: number
  totalPages: number
  basePath?: string
}

export function MarketplacePagination({ page, totalPages, basePath = '/marketplace' }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const goToPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newPage > 1) {
        params.set('page', String(newPage))
      } else {
        params.delete('page')
      }
      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`)
      })
    },
    [router, searchParams, basePath]
  )

  if (totalPages <= 1) return null

  // Build page numbers to show
  const pages: (number | 'ellipsis')[] = []
  const range = 2

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }

  return (
    <nav
      className={cn(
        'flex items-center justify-center gap-1 mt-10 transition-opacity',
        isPending && 'opacity-60'
      )}
      aria-label="Pagination"
    >
      <button
        onClick={() => goToPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#161822] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-500">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => goToPage(p)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              p === page
                ? 'bg-brand text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161822]'
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => goToPage(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#161822] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </nav>
  )
}
