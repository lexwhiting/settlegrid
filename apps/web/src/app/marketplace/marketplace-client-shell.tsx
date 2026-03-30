'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { ToolCard, type MarketplaceTool } from '@/components/marketplace/tool-card'
import { MarketplacePagination } from '@/components/marketplace/marketplace-filters'

/* ─── Constants ─────────────────────────────────────────────────────────────── */

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

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface MarketplaceClientShellProps {
  tools: MarketplaceTool[]
  total: number
  totalAll: number
  page: number
  totalPages: number
  ecosystemCount: number
  activeType?: string
  showTypeTabs?: boolean
  basePath?: string
}

export function MarketplaceClientShell({
  tools,
  total,
  totalAll,
  page,
  totalPages,
  ecosystemCount,
  activeType,
  showTypeTabs = true,
  basePath = '/marketplace',
}: MarketplaceClientShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

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
      params.delete('page')
      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`)
      })
    },
    [router, searchParams, basePath]
  )

  const filterSidebar = (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label
          htmlFor="mp-search"
          className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
        >
          Search
        </label>
        <input
          id="mp-search"
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

      {/* Category */}
      <div>
        <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Category
        </span>
        <div className="space-y-0.5">
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

      {/* Ecosystem */}
      <div>
        <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Ecosystem
        </span>
        <div className="space-y-0.5">
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
        <label
          htmlFor="mp-sort"
          className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
        >
          Sort By
        </label>
        <select
          id="mp-sort"
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

      {/* Stats Bar */}
      <div className="flex items-center justify-between mb-6 px-1">
        <p className="text-sm text-gray-400">
          <span className="text-amber-400 font-semibold">
            {totalAll.toLocaleString()}
          </span>{' '}
          tools indexed across{' '}
          <span className="text-amber-400 font-semibold">{ecosystemCount}</span> ecosystems
          {total !== totalAll && (
            <>
              {' '}
              &middot; Showing{' '}
              <span className="text-gray-200 font-medium">{total.toLocaleString()}</span> results
            </>
          )}
        </p>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className="lg:hidden flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors bg-[#161822] border border-[#2A2D3E] rounded-lg px-3 py-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
            />
          </svg>
          Filters
        </button>
      </div>

      {/* Mobile Filters */}
      {mobileFiltersOpen && (
        <div className="lg:hidden mb-6 bg-[#161822] rounded-xl border border-[#2A2D3E] p-4">
          {filterSidebar}
        </div>
      )}

      {/* Content: Sidebar + Grid */}
      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">{filterSidebar}</aside>

        {/* Tool Grid */}
        <div className="flex-1 min-w-0">
          {tools.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-[#161822] rounded-xl border border-[#2A2D3E] text-center">
              <div className="w-12 h-12 rounded-full bg-[#252836] border border-[#2A2D3E] flex items-center justify-center mb-4 text-gray-500" aria-hidden="true">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-100 mb-1">
                No tools match this filter yet
              </h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                Try adjusting your filters or be the first to publish.
              </p>
            </div>
          )}

          {/* Pagination */}
          <MarketplacePagination page={page} totalPages={totalPages} basePath={basePath} />
        </div>
      </div>
    </div>
  )
}
