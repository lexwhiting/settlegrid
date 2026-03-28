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
    <div className="relative bg-gradient-to-r from-[#1a1400] via-[#2a1f00] to-[#1a1400] border-b border-amber-500/30">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Pulsing dot */}
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
          </span>

          <div className="flex items-center gap-4 flex-wrap min-w-0">
            <span className="text-sm font-bold text-white">
              First 100 developers get lifetime free tier
            </span>

            {/* Progress bar */}
            <div className="flex items-center gap-2.5">
              <div className="w-28 h-2.5 rounded-full bg-black/40 border border-amber-500/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 shadow-sm shadow-amber-400/30"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-sm font-bold text-amber-300 tabular-nums whitespace-nowrap">
                {spotsRemaining} spots left
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/register"
            className="text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 rounded-full transition-colors shadow-md shadow-amber-500/30"
          >
            Claim yours →
          </Link>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-amber-500/50 hover:text-amber-300 transition-colors"
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
