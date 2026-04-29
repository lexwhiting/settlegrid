'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface TagFilterProps {
  tags: string[]
}

export function TagFilter({ tags }: TagFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTags = searchParams.get('tags')?.split(',').filter(Boolean) ?? []

  const handleToggle = useCallback(
    (tag: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const current = new Set(activeTags)
      if (current.has(tag)) {
        current.delete(tag)
      } else {
        current.add(tag)
      }
      if (current.size > 0) {
        params.set('tags', [...current].sort().join(','))
      } else {
        params.delete('tags')
      }
      router.push(`/templates?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, activeTags],
  )

  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => {
        const isActive = activeTags.includes(tag)
        return (
          <button
            key={tag}
            onClick={() => handleToggle(tag)}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
              isActive
                ? 'border-[#E5A336] bg-[#E5A336]/10 text-[#E5A336]'
                : 'border-gray-200 text-muted-foreground hover:border-gray-300 dark:border-[#2A2D3E] dark:hover:border-[#3A3F5A]'
            }`}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}
