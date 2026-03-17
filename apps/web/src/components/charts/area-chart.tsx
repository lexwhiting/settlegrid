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
}

export function AreaChart({
  data,
  xKey,
  yKey,
  yKeyPrevious,
  height = 200,
  color = '#10B981',
  formatValue = (v) => String(v),
  formatXAxis = (v) => v,
}: AreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
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
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            padding: '8px 12px',
          }}
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
  )
}
