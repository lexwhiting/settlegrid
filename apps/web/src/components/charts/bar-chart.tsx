'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BarChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  yKey: string
  height?: number
  color?: string
  formatValue?: (value: number) => string
  formatXAxis?: (value: string) => string
}

export function BarChart({
  data,
  xKey,
  yKey,
  height = 200,
  color = '#10B981',
  formatValue = (v) => String(v),
  formatXAxis = (v) => v,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
        <Bar
          dataKey={yKey}
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
