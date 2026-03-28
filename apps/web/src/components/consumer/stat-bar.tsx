'use client'

import { useEffect, useState } from 'react'

interface ToolBalance {
  toolId: string
  toolName: string
  toolSlug: string
  balanceCents: number
  autoRefill: boolean
}

interface ApiKey {
  id: string
  keyPrefix: string
  toolId: string
  status: string
  lastUsedAt: string | null
  createdAt: string
}

interface StatBarProps {
  balances: ToolBalance[]
  keys: ApiKey[]
}

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(safe / 100)
}

/** Wallet icon */
function WalletIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
      />
    </svg>
  )
}

/** Arrow-trending-up icon */
function SpendIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
      />
    </svg>
  )
}

/** Wrench/tool icon */
function ToolIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z"
      />
    </svg>
  )
}

/** Key icon */
function KeyIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
      />
    </svg>
  )
}

interface MonthlySpend {
  month: string
  spendCents: number
}

export function ConsumerStatBar({ balances, keys }: StatBarProps) {
  const [monthlySpendCents, setMonthlySpendCents] = useState<number | null>(null)

  const totalBalanceCents = balances.reduce((sum, b) => sum + b.balanceCents, 0)
  const activeTools = balances.filter((b) => b.balanceCents > 0).length
  const activeKeys = keys.filter((k) => k.status === 'active').length

  useEffect(() => {
    let cancelled = false

    async function fetchSpend() {
      try {
        const res = await fetch('/api/consumer/subscriptions')
        if (!res.ok) return
        const data: {
          monthlySpendTrend: MonthlySpend[]
        } = await res.json()

        if (cancelled) return

        // Find current month's spend from the trend data
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const currentEntry = data.monthlySpendTrend?.find(
          (m) => m.month === currentMonth
        )
        setMonthlySpendCents(currentEntry?.spendCents ?? 0)
      } catch {
        // Silently fail -- stat will show $0.00
        if (!cancelled) setMonthlySpendCents(0)
      }
    }

    fetchSpend()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = [
    {
      label: 'Total Balance',
      value: formatCents(totalBalanceCents),
      icon: <WalletIcon />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Spend This Month',
      value: monthlySpendCents !== null ? formatCents(monthlySpendCents) : '--',
      icon: <SpendIcon />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Active Tools',
      value: String(activeTools),
      icon: <ToolIcon />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Active Keys',
      value: String(activeKeys),
      icon: <KeyIcon />,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Consumer dashboard statistics">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white dark:bg-[#161822] border border-gray-200 dark:border-[#2A2D3E] rounded-xl p-5 flex items-start gap-4"
          role="group"
          aria-label={`${stat.label}: ${stat.value}`}
        >
          <div className={`${stat.bgColor} ${stat.color} rounded-lg p-2.5 shrink-0`} aria-hidden="true">
            {stat.icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
              {stat.label}
            </p>
            <p
              className={`text-2xl font-bold tabular-nums mt-0.5 ${
                stat.label === 'Total Balance'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
