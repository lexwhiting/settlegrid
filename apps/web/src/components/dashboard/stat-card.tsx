'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCountUp } from '@/hooks/use-count-up'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  /** Percentage change: positive = up (green), negative = down (red), 0 or undefined = no arrow */
  trend?: number
  /** 'danger' makes the value red regardless of trend */
  variant?: 'default' | 'danger'
  /** If true, the numeric portion of value will count up from 0 on mount */
  animate?: boolean
}

export function StatCard({ title, value, subtitle, trend, variant, animate = false }: StatCardProps) {
  // Extract numeric value for animation
  const numericMatch = value.match(/[\d,.]+/)
  const numericValue = numericMatch ? parseFloat(numericMatch[0].replace(/,/g, '')) : 0
  const animatedNum = useCountUp(numericValue, 800, animate)

  const showTrend = trend !== undefined && trend !== 0

  // Reconstruct the displayed value with animated number
  const displayValue = animate && numericMatch
    ? value.replace(numericMatch[0], animatedNum.toLocaleString())
    : value

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        boxShadow:
          '0 1px 2px rgba(196,137,30,0.04), 0 4px 8px rgba(196,137,30,0.03), 0 8px 24px rgba(196,137,30,0.02)',
      }}
    >
      {/* Gold edge top line */}
      <span
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
        style={{
          background:
            'linear-gradient(90deg, transparent, #E5A336 20%, #F5C963 50%, #E5A336 80%, transparent)',
        }}
      />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-indigo dark:text-gray-100'
          )}>
            {displayValue}
          </span>
          {showTrend && (
            <span className={cn(
              'inline-flex items-center text-xs font-medium',
              trend > 0 ? 'text-green-600' : 'text-red-600'
            )}>
              <svg
                className={cn('w-3 h-3 mr-0.5', trend < 0 && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </CardContent>
      {/* Gold reservoir level indicator */}
      <span
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(229,163,54,0.3) 30%, rgba(229,163,54,0.3) 70%, transparent)',
        }}
      />
    </Card>
  )
}
