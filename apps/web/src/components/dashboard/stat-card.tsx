import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  /** Percentage change: positive = up (green), negative = down (red), 0 or undefined = no arrow */
  trend?: number
  /** 'danger' makes the value red regardless of trend */
  variant?: 'default' | 'danger'
}

export function StatCard({ title, value, subtitle, trend, variant }: StatCardProps) {
  const showTrend = trend !== undefined && trend !== 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-indigo dark:text-gray-100'
          )}>
            {value}
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
    </Card>
  )
}
