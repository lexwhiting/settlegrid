'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface CategoryTabsProps {
  categories: { name: string; count: number }[]
  totalCount: number
}

export function CategoryTabs({ categories, totalCount }: CategoryTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category') ?? ''

  const handleSelect = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (category) {
        params.set('category', category)
      } else {
        params.delete('category')
      }
      params.delete('tags')
      router.push(`/templates?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => handleSelect('')}
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          !activeCategory
            ? 'bg-[#E5A336] text-[#0a0a0a]'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#252836] dark:text-gray-400 dark:hover:bg-[#2A2F4A]'
        }`}
      >
        All ({totalCount})
      </button>
      {categories.map((cat) => (
        <button
          key={cat.name}
          onClick={() => handleSelect(cat.name)}
          className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === cat.name
              ? 'bg-[#E5A336] text-[#0a0a0a]'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#252836] dark:text-gray-400 dark:hover:bg-[#2A2F4A]'
          }`}
        >
          {cat.name} ({cat.count})
        </button>
      ))}
    </div>
  )
}
