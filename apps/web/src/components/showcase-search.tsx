'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

/* -- Types ----------------------------------------------------------------- */

interface PricingConfig {
  model?: string
  defaultCostCents?: number
  costPerToken?: number
  costPerMB?: number
  costPerSecond?: number
  methods?: Record<string, { costCents: number; displayName?: string }>
  outcomeConfig?: { successCostCents: number; failureCostCents?: number }
}

export interface ShowcaseTool {
  name: string
  slug: string
  description: string | null
  category: string | null
  tags: string[] | null
  totalInvocations: number
  currentVersion: string
  verified?: boolean
  developerName: string | null
  developerSlug: string | null
  pricingConfig?: PricingConfig | null
}

/* -- Category labels + colors ---------------------------------------------- */

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  data:    { label: 'Data',    color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  nlp:     { label: 'NLP',     color: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
  image:   { label: 'Image',   color: 'bg-pink-500/15 text-pink-400 border-pink-500/25' },
  code:    { label: 'Code',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  search:  { label: 'Search',  color: 'bg-violet-500/15 text-violet-400 border-violet-500/25' },
  finance: { label: 'Finance', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  science: { label: 'Science', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  media:   { label: 'Media',   color: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25' },
  security:      { label: 'Security',      color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  communication: { label: 'Communication', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' },
  utility: { label: 'Utility', color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' },
}

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { label: cat, color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' }
}

function formatInvocations(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatPricing(pricingConfig?: PricingConfig | null): string | null {
  if (!pricingConfig || !pricingConfig.model) return null
  switch (pricingConfig.model) {
    case 'per-invocation': {
      const cents = pricingConfig.defaultCostCents ?? 0
      return cents < 100 ? `${cents}\u00A2/call` : `$${(cents / 100).toFixed(2)}/call`
    }
    case 'per-token': {
      const rate = pricingConfig.costPerToken ?? 0
      return `$${(rate * 1000).toFixed(3)}/1K tokens`
    }
    case 'per-byte': {
      const cents = pricingConfig.costPerMB ?? 0
      return cents < 100 ? `${cents}\u00A2/MB` : `$${(cents / 100).toFixed(2)}/MB`
    }
    case 'per-second': {
      const cents = pricingConfig.costPerSecond ?? 0
      return cents < 100 ? `${cents}\u00A2/sec` : `$${(cents / 100).toFixed(2)}/sec`
    }
    case 'tiered': {
      const methods = pricingConfig.methods
      if (!methods) return 'Tiered pricing'
      const lowestCents = Math.min(...Object.values(methods).map((m) => m.costCents))
      return lowestCents < 100 ? `From ${lowestCents}\u00A2/call` : `From $${(lowestCents / 100).toFixed(2)}/call`
    }
    case 'outcome': {
      const cents = pricingConfig.outcomeConfig?.successCostCents ?? 0
      return cents < 100 ? `${cents}\u00A2 on success` : `$${(cents / 100).toFixed(2)} on success`
    }
    default:
      return null
  }
}

const FEATURED_THRESHOLD = 1_000
const PAGE_SIZE = 60

/* -- Verified badge -------------------------------------------------------- */

function VerifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/25 shrink-0"
      title="Verified: this tool has processed real invocations"
      aria-label="Verified tool"
    >
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M16.403 12.652a3 3 0 0 1 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 1-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 1 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 1 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
      </svg>
      Verified
    </span>
  )
}

/* -- Component ------------------------------------------------------------- */

export function ShowcaseSearch({ tools }: { tools: ShowcaseTool[] }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Build category counts (only from non-null categories)
  const categories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tools) {
      if (t.category) {
        counts[t.category] = (counts[t.category] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count, ...getCategoryMeta(key) }))
  }, [tools])

  // Featured tools: highest invocation count
  const featured = useMemo(
    () =>
      tools
        .filter((t) => t.totalInvocations >= FEATURED_THRESHOLD)
        .sort((a, b) => b.totalInvocations - a.totalInvocations)
        .slice(0, 6),
    [tools]
  )

  // Filter tools
  const filtered = useMemo(() => {
    let result = tools
    if (activeCategory) {
      result = result.filter((t) => t.category === activeCategory)
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          t.slug.toLowerCase().includes(q)
      )
    }
    return result
  }, [tools, query, activeCategory])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const isFiltering = query.trim() !== '' || activeCategory !== null

  return (
    <>
      {/* -- Featured section ------------------------------------------------ */}
      {featured.length > 0 && !isFiltering && (
        <div className="mb-14">
          <h2 className="text-lg font-semibold text-gray-100 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            Featured Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((tool) => {
              const meta = tool.category ? getCategoryMeta(tool.category) : null
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group rounded-xl border border-amber-500/25 bg-gradient-to-br from-[#161822] to-[#151722] p-5 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/5"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm leading-tight truncate">
                        {tool.name}
                      </h3>
                      {tool.verified && <VerifiedBadge />}
                    </div>
                    {meta && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0 ${meta.color}`}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                  {/* Developer name hidden until multi-developer adoption */}
                  {tool.description && (
                    <p className="text-xs text-gray-400 leading-relaxed mb-4 line-clamp-2">
                      {tool.description.length > 120
                        ? `${tool.description.slice(0, 120)}...`
                        : tool.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-[#252836]">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-500">
                        v{tool.currentVersion}
                      </span>
                      <span className="text-[11px] text-amber-400/70">
                        {formatInvocations(tool.totalInvocations)} calls
                      </span>
                      {formatPricing(tool.pricingConfig) && (
                        <span className="text-[11px] text-amber-400/80 font-medium">
                          {formatPricing(tool.pricingConfig)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View storefront &rarr;
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* -- Search bar ------------------------------------------------------ */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
            placeholder={`Search ${tools.length} tools by name, description, or slug...`}
            className="w-full pl-12 pr-4 py-3.5 bg-[#161822] border border-[#2A2D3E] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm"
            aria-label="Search tools"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* -- Category filter pills ------------------------------------------- */}
      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => { setActiveCategory(null); setVisibleCount(PAGE_SIZE) }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeCategory === null
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-[#161822] text-gray-400 border-[#2A2D3E] hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            All <span className="text-[10px] opacity-70">{tools.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(activeCategory === cat.key ? null : cat.key); setVisibleCount(PAGE_SIZE) }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeCategory === cat.key
                  ? cat.color
                  : 'bg-[#161822] text-gray-400 border-[#2A2D3E] hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {cat.label}{' '}
              <span className="text-[10px] opacity-70">{cat.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* -- Results count --------------------------------------------------- */}
      <p className="text-sm text-gray-500 mb-6 text-center">
        {filtered.length === tools.length
          ? `Showing all ${tools.length} tools`
          : `Showing ${filtered.length} of ${tools.length} tools`}
      </p>

      {/* -- Tools grid ------------------------------------------------------ */}
      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
            {visible.map((tool) => {
              const meta = tool.category ? getCategoryMeta(tool.category) : null
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group rounded-xl border border-[#2A2D3E] bg-[#161822] p-5 hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/5"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm leading-tight truncate">
                        {tool.name}
                      </h3>
                      {tool.verified && <VerifiedBadge />}
                    </div>
                    {meta && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0 ${meta.color}`}>
                        {meta.label}
                      </span>
                    )}
                  </div>

                  {/* Developer */}
                  {/* Developer name hidden until multi-developer adoption */}

                  {/* Description */}
                  {tool.description && (
                    <p className="text-xs text-gray-400 leading-relaxed mb-4 line-clamp-2">
                      {tool.description.length > 120
                        ? `${tool.description.slice(0, 120)}...`
                        : tool.description}
                    </p>
                  )}

                  {/* Tags */}
                  {tool.tags && tool.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tool.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded bg-[#252836] px-1.5 py-0.5 text-[10px] text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                      {tool.tags.length > 3 && (
                        <span className="text-[10px] text-gray-600">
                          +{tool.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#252836]">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-500">
                        v{tool.currentVersion}
                      </span>
                      {tool.totalInvocations > 0 && (
                        <span className="text-[11px] text-gray-500">
                          {formatInvocations(tool.totalInvocations)} calls
                        </span>
                      )}
                      {formatPricing(tool.pricingConfig) && (
                        <span className="text-[11px] text-amber-400/80 font-medium">
                          {formatPricing(tool.pricingConfig)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View storefront &rarr;
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
          {hasMore && (
            <div className="text-center mb-20">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-6 py-2.5 rounded-lg border border-[#2A2D3E] text-sm font-medium text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors"
              >
                Show more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-[#2A2D3E] bg-[#161822] p-12 text-center mb-20">
          <p className="text-gray-400 mb-2">No tools match your search.</p>
          <button
            onClick={() => {
              setQuery('')
              setActiveCategory(null)
            }}
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  )
}
