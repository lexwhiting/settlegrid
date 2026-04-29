'use client'

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface AreaChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  yKey: string
  /** Optional second series for previous period comparison (dashed) */
  yKeyPrevious?: string
  height?: number
  color?: string
  formatValue?: (value: number) => string
  formatXAxis?: (value: string) => string
  /** Accessible label for screen readers */
  ariaLabel?: string
}

export function AreaChart({
  data,
  xKey,
  yKey,
  yKeyPrevious,
  height = 200,
  color = '#E5A336',
  formatValue = (v) => String(v),
  formatXAxis = (v) => v,
  ariaLabel,
}: AreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No data available
      </div>
    )
  }

  return (
    <div role="img" aria-label={ariaLabel ?? `Area chart of ${yKey}`}>
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5C963" stopOpacity={0.3} />
            <stop offset="40%" stopColor="#E5A336" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#C4891E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={formatXAxis}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={(v) => formatValue(v as number)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1A1F3A',
            border: '1px solid rgba(229, 163, 54, 0.3)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
          cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
          formatter={(value: number) => [formatValue(value), '']}
          labelFormatter={formatXAxis}
        />
        {yKeyPrevious && (
          <Area
            type="monotone"
            dataKey={yKeyPrevious}
            stroke="#9CA3AF"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            dot={false}
          />
        )}
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${yKey})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: color }}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
    </div>
  )
}
