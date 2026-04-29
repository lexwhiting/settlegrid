'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { TemplateCard } from './TemplateCard'
import { CategoryTabs } from './CategoryTabs'
import { TagFilter } from './TagFilter'
import { SearchBar } from './SearchBar'
import { sortTemplates, filterTemplates } from '@/lib/registry-helpers'
import type { TemplateManifest } from '@/lib/registry-helpers'
import { SEARCH_ENABLED } from '@/env'

interface TemplateGalleryProps {
  templates: TemplateManifest[]
  categories: { name: string; count: number }[]
  totalCount: number
}

export function TemplateGallery({
  templates,
  categories,
  totalCount,
}: TemplateGalleryProps) {
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category') ?? ''
  const activeTags = useMemo(
    () => searchParams.get('tags')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  )

  const filtered = useMemo(
    () =>
      filterTemplates(templates, {
        category: activeCategory || undefined,
        tags: activeTags.length > 0 ? activeTags : undefined,
      }),
    [templates, activeCategory, activeTags],
  )

  const sorted = useMemo(() => sortTemplates(filtered), [filtered])

  // Compute tags for the current category filter
  const visibleTags = useMemo(() => {
    const source = activeCategory
      ? templates.filter((t) => t.category === activeCategory)
      : templates
    const tagSet = new Set<string>()
    for (const t of source) {
      for (const tag of t.tags) {
        tagSet.add(tag)
      }
    }
    return [...tagSet].sort()
  }, [templates, activeCategory])

  return (
    <>
      {/* Search — live Meilisearch when configured, disabled stub otherwise */}
      {SEARCH_ENABLED ? (
        <SearchBar
          category={activeCategory || undefined}
          tags={activeTags.length > 0 ? activeTags : undefined}
        />
      ) : (
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search templates..."
            disabled
            className="w-full rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm text-muted-foreground placeholder:text-muted-foreground/50 dark:border-[#2A2D3E] dark:bg-[#161822] cursor-not-allowed opacity-60"
          />
        </div>
      )}

      {/* Category Tabs */}
      <div className="mb-4">
        <CategoryTabs categories={categories} totalCount={totalCount} />
      </div>

      {/* Tag Filter */}
      <div className="mb-8">
        <TagFilter tags={visibleTags} />
      </div>

      {/* Grid */}
      {sorted.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((t) => (
            <TemplateCard key={t.slug} template={t} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          No templates match the current filters.
        </div>
      )}
    </>
  )
}
