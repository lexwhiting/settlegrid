'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { searchTemplates, sanitizeHighlight, type TemplateSearchResult } from '@/lib/meilisearch-client'

interface SearchBarProps {
  category?: string
  tags?: string[]
}

export function SearchBar({ category, tags }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TemplateSearchResult | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchTemplates(query, { category, tags })
        setResults(res)
        setIsOpen(true)
        setActiveIndex(-1)
      } catch {
        // Search is best-effort — fail silently on network errors
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query, category, tags])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hits = results?.hits ?? []

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || hits.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) => (prev < hits.length - 1 ? prev + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : hits.length - 1))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && activeIndex < hits.length) {
            router.push(`/templates/${hits[activeIndex].slug}`)
          }
          break
        case 'Escape':
          setIsOpen(false)
          inputRef.current?.blur()
          break
      }
    },
    [isOpen, hits, activeIndex, router],
  )

  return (
    <div ref={containerRef} className="relative mb-6">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results && query.trim()) setIsOpen(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search templates..."
        className="w-full rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#E5A336]/40 focus:border-[#E5A336] dark:border-[#2A2D3E] dark:bg-[#161822]"
      />

      {isOpen && hits.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-[#2A2D3E] dark:bg-[#161822] max-h-80 overflow-y-auto">
          {hits.map((hit, i) => (
            <Link
              key={hit.slug}
              href={`/templates/${hit.slug}`}
              className={`block px-4 py-3 text-sm transition-colors border-b border-gray-100 last:border-0 dark:border-[#2A2D3E] ${
                i === activeIndex
                  ? 'bg-[#E5A336]/10'
                  : 'hover:bg-gray-50 dark:hover:bg-[#1E2030]'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="font-medium text-foreground">
                {hit._formatted?.name ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHighlight(hit._formatted.name),
                    }}
                  />
                ) : (
                  hit.name
                )}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {hit._formatted?.description ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHighlight(hit._formatted.description),
                    }}
                  />
                ) : (
                  hit.description
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {isOpen && query.trim() && hits.length === 0 && results && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-[#2A2D3E] dark:bg-[#161822] px-4 py-6 text-center text-sm text-muted-foreground">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
