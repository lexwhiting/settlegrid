'use client'

import { useState } from 'react'
import Link from 'next/link'

const REVENUE_LEVELS = [500, 1000, 5000, 10000, 25000, 50000, 100000]

function calculateSettleGridTake(cents: number): number {
  let take = 0
  const brackets = [
    { upTo: 100_000, rate: 0 },
    { upTo: 1_000_000, rate: 0.02 },
    { upTo: 5_000_000, rate: 0.03 },
    { upTo: Infinity, rate: 0.05 },
  ]
  let remaining = cents
  let prev = 0
  for (const b of brackets) {
    const span = Math.min(remaining, b.upTo - prev)
    if (span <= 0) break
    take += span * b.rate
    remaining -= span
    prev = b.upTo
  }
  return Math.round(take)
}

export function SavingsCalculator() {
  const [selectedIdx, setSelectedIdx] = useState(2) // default $5,000

  const revenue = REVENUE_LEVELS[selectedIdx]
  const revenueCents = revenue * 100
  const sgTakeCents = calculateSettleGridTake(revenueCents)
  const sgKeep = revenue - sgTakeCents / 100
  const mcpizeKeep = revenue * 0.85
  const xpayKeep = revenue * 0.975

  const competitors = [
    { name: 'SettleGrid', keep: sgKeep, pct: ((sgKeep / revenue) * 100).toFixed(1), color: 'bg-brand' },
    { name: 'xpay.sh (2.5%)', keep: xpayKeep, pct: ((xpayKeep / revenue) * 100).toFixed(1), color: 'bg-teal-500' },
    { name: 'MCPize (15%)', keep: mcpizeKeep, pct: ((mcpizeKeep / revenue) * 100).toFixed(1), color: 'bg-blue-500' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">Monthly revenue:</span>
        <span className="text-xl font-bold text-gray-100">${revenue.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={0}
        max={REVENUE_LEVELS.length - 1}
        value={selectedIdx}
        onChange={(e) => setSelectedIdx(Number(e.target.value))}
        className="w-full h-2 bg-[#252836] rounded-lg appearance-none cursor-pointer accent-brand mb-6"
        aria-label="Monthly revenue slider"
      />

      <div className="space-y-3">
        {competitors.map((c) => (
          <div key={c.name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className={c.name === 'SettleGrid' ? 'text-brand font-semibold' : 'text-gray-400'}>{c.name}</span>
              <span className={c.name === 'SettleGrid' ? 'text-brand font-bold' : 'text-gray-300'}>
                ${Math.max(0, Math.round(c.keep)).toLocaleString()} ({c.pct}%)
              </span>
            </div>
            <div className="w-full h-3 bg-[#252836] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${c.color}`}
                style={{ width: `${Math.max(0, Math.min(100, Number(c.pct)))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-gray-500 mt-4">
        <Link href="/pricing" className="text-brand hover:text-brand-dark transition-colors">
          Full pricing details →
        </Link>
      </p>
    </div>
  )
}
