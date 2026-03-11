'use client'

import { cn } from '@/lib/utils'

interface SettleGridLogoProps {
  variant?: 'horizontal' | 'compact' | 'mark'
  className?: string
  size?: number
}

/**
 * Grid/settlement visual mark — a 3x3 grid pattern with the center cell
 * highlighted in brand emerald green, evoking a settlement/clearing grid.
 */
function GridMark({ size, className }: { size: number; className?: string }) {
  const cellSize = size / 4
  const gap = size / 16
  const radius = size / 20

  // 3x3 grid positions
  const cells = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
    { row: 1, col: 1 }, // center — brand color
    { row: 1, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
  ]

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {cells.map(({ row, col }) => {
        const isCenter = row === 1 && col === 1
        const x = col * (cellSize + gap) + gap
        const y = row * (cellSize + gap) + gap

        return (
          <rect
            key={`${row}-${col}`}
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            rx={radius}
            fill={isCenter ? '#10B981' : '#1A1F3A'}
            opacity={isCenter ? 1 : row === 1 || col === 1 ? 0.7 : 0.3}
          />
        )
      })}
    </svg>
  )
}

/**
 * SettleGrid wordmark rendered as styled text.
 */
function Wordmark({
  size,
  className,
}: {
  size: number
  className?: string
}) {
  const fontSize = size * 0.6

  return (
    <span
      className={cn('font-bold tracking-tight select-none', className)}
      style={{ fontSize, lineHeight: 1, color: '#1A1F3A' }}
    >
      Settle<span style={{ color: '#10B981' }}>Grid</span>
    </span>
  )
}

/**
 * SettleGrid logo component with three variants:
 * - "horizontal": Grid mark + wordmark side by side
 * - "compact": Grid mark + smaller wordmark
 * - "mark": Grid mark only
 */
export function SettleGridLogo({
  variant = 'horizontal',
  className,
  size = 32,
}: SettleGridLogoProps) {
  if (variant === 'mark') {
    return <GridMark size={size} className={className} />
  }

  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <GridMark size={size * 0.75} />
        <Wordmark size={size * 0.7} />
      </div>
    )
  }

  // horizontal (default)
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <GridMark size={size} />
      <Wordmark size={size} />
    </div>
  )
}
