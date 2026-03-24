'use client'

import { useState, useMemo } from 'react'

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface CatalogEntry {
  slug: string
  name: string
  description: string
  category: string
  methods: number
  github: string
}

/* ── Category labels + colors ──────────────────────────────────────────────── */

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  finance:       { label: 'Finance',       color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  science:       { label: 'Science',       color: 'bg-violet-500/15 text-violet-400 border-violet-500/25' },
  weather:       { label: 'Weather',       color: 'bg-sky-500/15 text-sky-400 border-sky-500/25' },
  developer:     { label: 'Developer',     color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  health:        { label: 'Health',        color: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
  government:    { label: 'Government',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  media:         { label: 'Media',         color: 'bg-pink-500/15 text-pink-400 border-pink-500/25' },
  data:          { label: 'Data',          color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  security:      { label: 'Security',      color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  communication: { label: 'Communication', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' },
  education:     { label: 'Education',     color: 'bg-teal-500/15 text-teal-400 border-teal-500/25' },
  environment:   { label: 'Environment',   color: 'bg-lime-500/15 text-lime-400 border-lime-500/25' },
  text:          { label: 'Text & NLP',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
  travel:        { label: 'Travel',        color: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25' },
  gaming:        { label: 'Gaming',        color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  shipping:      { label: 'Shipping',      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  iot:           { label: 'IoT',           color: 'bg-green-500/15 text-green-400 border-green-500/25' },
  utility:       { label: 'Utility',       color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' },
  crypto:        { label: 'Crypto',        color: 'bg-yellow-600/15 text-yellow-500 border-yellow-600/25' },
  sports:        { label: 'Sports',        color: 'bg-blue-400/15 text-blue-300 border-blue-400/25' },
  food:          { label: 'Food',          color: 'bg-orange-400/15 text-orange-300 border-orange-400/25' },
  geo:           { label: 'Geospatial',    color: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/25' },
}

const PAGE_SIZE = 60

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { label: cat, color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' }
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function ServerSearch({ servers }: { servers: CatalogEntry[] }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Build category counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of servers) {
      counts[s.category] = (counts[s.category] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count, ...getCategoryMeta(key) }))
  }, [servers])

  // Filter servers
  const filtered = useMemo(() => {
    let result = servers
    if (activeCategory) {
      result = result.filter((s) => s.category === activeCategory)
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q)
      )
    }
    return result
  }, [servers, query, activeCategory])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <>
      {/* ── Search bar ─────────────────────────────────────────────── */}
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
            placeholder="Search 1,017 templates by name or description..."
            className="w-full pl-12 pr-4 py-3.5 bg-[#1A1D2E] border border-[#2E3148] rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
            aria-label="Search servers"
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

      {/* ── Category filter pills ──────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        <button
          onClick={() => { setActiveCategory(null); setVisibleCount(PAGE_SIZE) }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            activeCategory === null
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-[#1A1D2E] text-gray-400 border-[#2E3148] hover:border-gray-500 hover:text-gray-300'
          }`}
        >
          All <span className="text-[10px] opacity-70">{servers.length}</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(activeCategory === cat.key ? null : cat.key); setVisibleCount(PAGE_SIZE) }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeCategory === cat.key
                ? cat.color
                : 'bg-[#1A1D2E] text-gray-400 border-[#2E3148] hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            {cat.label}{' '}
            <span className="text-[10px] opacity-70">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* ── Results count ──────────────────────────────────────────── */}
      <p className="text-sm text-gray-500 mb-6 text-center">
        {filtered.length === servers.length
          ? `Showing all ${servers.length} servers`
          : `Showing ${filtered.length} of ${servers.length} servers`}
      </p>

      {/* ── Server grid ────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((server) => {
            const meta = getCategoryMeta(server.category)
            return (
              <a
                key={server.slug}
                href={server.github}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-[#2E3148] bg-[#1A1D2E] p-5 hover:border-emerald-500/40 transition-all hover:shadow-lg hover:shadow-emerald-500/5"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors text-sm leading-tight">
                    {server.name}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0 ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 leading-relaxed mb-4 line-clamp-2">
                  {server.description.length > 120
                    ? `${server.description.slice(0, 120)}...`
                    : server.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[#252836]">
                  <span className="text-[11px] text-gray-500">
                    {server.methods} method{server.methods !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Fork on GitHub
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </span>
                </div>
              </a>
            )
          })}
        </div>
        {hasMore && (
          <div className="text-center mt-8">
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="px-6 py-2.5 rounded-lg border border-[#2E3148] text-sm font-medium text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors"
            >
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="rounded-xl border border-[#2E3148] bg-[#1A1D2E] p-12 text-center">
          <p className="text-gray-400 mb-2">No servers match your search.</p>
          <button
            onClick={() => {
              setQuery('')
              setActiveCategory(null)
            }}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  )
}
