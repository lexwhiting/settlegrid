'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string
  a: string
}

interface FaqCategory {
  title: string
  items: FaqItem[]
}

interface FaqAccordionProps {
  categories: Array<{ title: string; faqs: Array<{ q: string; a: string }> }>
}

// ─── Chevron SVG ─────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ─── Thumbs SVGs ─────────────────────────────────────────────────────────────

function ThumbUpIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
    </svg>
  )
}

function ThumbDownIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
    </svg>
  )
}

// ─── Search icon ─────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const VOTED_KEY = 'settlegrid:faq-votes'

function getVotedQuestions(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(VOTED_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed as string[])
    return new Set()
  } catch {
    return new Set()
  }
}

function markVoted(question: string): void {
  if (typeof window === 'undefined') return
  try {
    const voted = getVotedQuestions()
    voted.add(question)
    localStorage.setItem(VOTED_KEY, JSON.stringify([...voted]))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ─── Collapsible answer with smooth height animation ─────────────────────────

function CollapsibleContent({ open, children }: { open: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [open, children])

  return (
    <div
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      style={{ maxHeight: open ? `${height}px` : '0px' }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  )
}

// ─── Feedback widget ─────────────────────────────────────────────────────────

function FeedbackWidget({ question }: { question: string }) {
  const [voted, setVoted] = useState<boolean | null>(null)
  const [alreadyVoted, setAlreadyVoted] = useState(false)

  useEffect(() => {
    const votedSet = getVotedQuestions()
    if (votedSet.has(question)) {
      setAlreadyVoted(true)
    }
  }, [question])

  const handleVote = useCallback(
    (helpful: boolean) => {
      setVoted(helpful)
      markVoted(question)

      // Fire-and-forget POST
      fetch('/api/faq-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          helpful,
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {
        // Silently ignore network errors
      })
    },
    [question]
  )

  if (alreadyVoted || voted !== null) {
    return (
      <p className="text-xs text-gray-400 mt-3">
        Thanks for your feedback!
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-xs text-gray-400">Was this helpful?</span>
      <button
        type="button"
        onClick={() => handleVote(true)}
        className="p-1 rounded transition-colors text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        aria-label={`Mark "${question}" as helpful`}
      >
        <ThumbUpIcon />
      </button>
      <button
        type="button"
        onClick={() => handleVote(false)}
        className="p-1 rounded transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        aria-label={`Mark "${question}" as not helpful`}
      >
        <ThumbDownIcon />
      </button>
    </div>
  )
}

// ─── Single accordion item ──────────────────────────────────────────────────

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-gray-100 dark:border-[#252836]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 text-left gap-3"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-indigo dark:text-gray-100">{item.q}</span>
        <ChevronIcon open={isOpen} />
      </button>
      <CollapsibleContent open={isOpen}>
        <div className="pb-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.a}</p>
          <FeedbackWidget question={item.q} />
        </div>
      </CollapsibleContent>
    </div>
  )
}

// ─── Category group ─────────────────────────────────────────────────────────

function CategoryGroup({ category, items }: { category: string; items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleToggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }, [])

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-8 mb-4 font-semibold">
        {category}
      </h3>
      <div>
        {items.map((item, i) => (
          <AccordionItem
            key={item.q}
            item={item}
            isOpen={openIndex === i}
            onToggle={() => handleToggle(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function FaqAccordion({ categories: rawCategories }: FaqAccordionProps) {
  const [search, setSearch] = useState('')

  // Normalize to internal shape
  const categories: FaqCategory[] = useMemo(
    () =>
      rawCategories.map((c) => ({
        title: c.title,
        items: c.faqs.map((f) => ({ q: f.q, a: f.a })),
      })),
    [rawCategories]
  )

  // Filter categories/items by search query
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return categories

    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)
        ),
      }))
      .filter((cat) => cat.items.length > 0)
  }, [categories, search])

  const totalResults = useMemo(
    () => filtered.reduce((sum, cat) => sum + cat.items.length, 0),
    [filtered]
  )

  const isSearching = search.trim().length > 0

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search FAQs..."
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#161822] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
          aria-label="Search frequently asked questions"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Results count */}
      {isSearching && (
        <p className="text-xs text-gray-400 mb-4">
          {totalResults} {totalResults === 1 ? 'result' : 'results'}
        </p>
      )}

      {/* FAQ content */}
      {filtered.length > 0 ? (
        filtered.map((cat) => (
          <CategoryGroup key={cat.title} category={cat.title} items={cat.items} />
        ))
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No matching questions. Try rephrasing or contact{' '}
            <a
              href="mailto:support@settlegrid.ai"
              className="text-brand hover:underline"
            >
              support@settlegrid.ai
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
