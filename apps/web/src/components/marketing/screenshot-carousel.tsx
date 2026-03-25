'use client'

import { useState, useEffect, useCallback } from 'react'

interface Slide {
  src: string
  alt: string
  label: string
  url: string
}

const SLIDES: Slide[] = [
  {
    src: '/screenshots/Dashboard 1.jpg',
    alt: 'SettleGrid developer dashboard showing revenue, invocations, and usage analytics',
    label: 'Dashboard Overview',
    url: 'settlegrid.ai/dashboard',
  },
  {
    src: '/screenshots/Tools.jpg',
    alt: 'Tools management page with verified badges and quality checklist',
    label: 'Tool Management',
    url: 'settlegrid.ai/dashboard/tools',
  },
  {
    src: '/screenshots/Analytics 1.jpg',
    alt: 'Analytics page with invocation charts, revenue trends, and method breakdown',
    label: 'Analytics & Insights',
    url: 'settlegrid.ai/dashboard/analytics',
  },
  {
    src: '/screenshots/Reviews.jpg',
    alt: 'Reviews dashboard with ratings summary, response management, and consumer feedback',
    label: 'Reviews & Reputation',
    url: 'settlegrid.ai/dashboard/reviews',
  },
]

const AUTO_ADVANCE_MS = 5000

export function ScreenshotCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % SLIDES.length)
  }, [])

  const prev = useCallback(() => {
    setActive((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)
  }, [])

  // Auto-advance
  useEffect(() => {
    if (paused) return
    const timer = setInterval(next, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [paused, next])

  const slide = SLIDES[active]

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Browser chrome */}
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#2E3148] shadow-2xl shadow-black/20">
        <div className="bg-gray-100 dark:bg-[#1A1D2E] px-4 py-2.5 flex items-center gap-2 border-b border-gray-200 dark:border-[#2E3148]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
            <div className="w-3 h-3 rounded-full bg-green-400/80" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-white dark:bg-[#252836] rounded-md px-3 py-1 text-xs text-gray-400 dark:text-gray-500 text-center transition-all">
              {slide.url}
            </div>
          </div>
        </div>

        {/* Screenshot with fade transition — fixed aspect ratio container */}
        <div className="relative overflow-hidden bg-[#0F1117]" style={{ aspectRatio: '16 / 9' }}>
          {SLIDES.map((s, i) => (
            <img
              key={s.src}
              src={s.src}
              alt={s.alt}
              className={`absolute inset-0 w-full h-full object-contain object-top transition-opacity duration-500 ${
                i === active ? 'opacity-100' : 'opacity-0'
              }`}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      </div>

      {/* Prev/Next arrows — positioned outside the frame for consistency */}
      <button
        onClick={prev}
        className="absolute -left-5 sm:-left-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/90 hover:text-white hover:bg-black/70 hover:border-white/20 transition-all flex items-center justify-center shadow-lg"
        aria-label="Previous screenshot"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button
        onClick={next}
        className="absolute -right-5 sm:-right-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/90 hover:text-white hover:bg-black/70 hover:border-white/20 transition-all flex items-center justify-center shadow-lg"
        aria-label="Next screenshot"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Dots + label */}
      <div className="flex items-center justify-center gap-4 mt-5">
        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.src}
              onClick={() => setActive(i)}
              className={`transition-all rounded-full ${
                i === active
                  ? 'w-8 h-2 bg-brand'
                  : 'w-2 h-2 bg-gray-400 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
              aria-label={`View ${s.label}`}
              aria-current={i === active ? 'true' : undefined}
            />
          ))}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {slide.label}
        </span>
      </div>
    </div>
  )
}
