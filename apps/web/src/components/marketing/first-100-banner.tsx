'use client'

import { useState } from 'react'
import Link from 'next/link'

export function First100Banner({
  spotsRemaining,
  developerCount,
}: {
  spotsRemaining: number
  developerCount: number
}) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || spotsRemaining <= 0) return null

  const progressPct = Math.round((developerCount / 100) * 100)

  return (
    <div className="relative bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/40 border-b border-amber-700/30">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Pulsing dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
          </span>

          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="text-sm font-semibold text-amber-300">
              First 100 developers get lifetime free tier
            </span>

            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-amber-950/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-bold text-amber-400 tabular-nums whitespace-nowrap">
                {spotsRemaining} spots left
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/register"
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white px-4 py-1.5 rounded-full transition-colors shadow-sm shadow-amber-500/20"
          >
            Claim yours
          </Link>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-amber-500/60 hover:text-amber-400 transition-colors"
            aria-label="Dismiss banner"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
