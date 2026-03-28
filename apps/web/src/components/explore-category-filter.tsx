'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CategoryDefinition, CategoryType } from '@/lib/categories'

type FilterMode = 'all' | CategoryType

interface ExploreCategoryFilterProps {
  categories: CategoryDefinition[]
  countMap: Record<string, number>
}

export function ExploreCategoryFilter({ categories, countMap }: ExploreCategoryFilterProps) {
  const [filter, setFilter] = useState<FilterMode>('all')

  const filtered = filter === 'all'
    ? categories
    : categories.filter((c) => c.categoryType === filter)

  return (
    <>
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
              : 'text-gray-400 border border-[#2A2D3E] hover:text-gray-100 hover:border-gray-500'
          }`}
        >
          All Services
          <span className="ml-2 text-xs opacity-75">{categories.length}</span>
        </button>
        <button
          onClick={() => setFilter('mcp-tool')}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'mcp-tool'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
              : 'text-gray-400 border border-[#2A2D3E] hover:text-gray-100 hover:border-gray-500'
          }`}
        >
          MCP Tools
          <span className="ml-2 text-xs opacity-75">{categories.filter((c) => c.categoryType === 'mcp-tool').length}</span>
        </button>
        <button
          onClick={() => setFilter('ai-service')}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'ai-service'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
              : 'text-gray-400 border border-[#2A2D3E] hover:text-gray-100 hover:border-gray-500'
          }`}
        >
          AI Services
          <span className="ml-2 text-xs opacity-75">{categories.filter((c) => c.categoryType === 'ai-service').length}</span>
        </button>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
        {filtered.map((cat) => {
          const count = countMap[cat.slug] ?? 0
          const href = cat.categoryType === 'ai-service'
            ? `/solutions/${cat.slug}`
            : `/explore/category/${cat.slug}`
          return (
            <Link
              key={cat.slug}
              href={href}
              className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                      {cat.name}
                    </h2>
                    {cat.categoryType === 'mcp-tool' ? (
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cat.color}`}>
                        {count}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                        Solution
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                    {cat.description.split('.')[0]}.
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
