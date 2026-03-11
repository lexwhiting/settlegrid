'use client'

import { cn } from '@/lib/utils'

interface SettleGridLogoProps {
  variant?: 'horizontal' | 'compact' | 'mark'
  theme?: 'light' | 'dark'
  className?: string
  size?: number
}

/**
 * Official Flow Grid icon — 9 circles in a 3x3 grid with cross-shaped
 * flow lines converging on the center hub. Represents a settlement network
 * with transactions flowing through a central processor.
 *
 * Center hub: larger radius, 100% opacity (the settlement processor)
 * Cardinal nodes: standard radius, 100% opacity (active endpoints)
 * Corner nodes: standard radius, 35% opacity (network periphery)
 * Flow lines: connecting cardinal nodes to center, 40% opacity
 */
function FlowGrid({ size, color, className }: { size: number; color: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(6,6)">
        {/* Corner nodes — 35% opacity (network periphery) */}
        <circle cx="4" cy="4" r="3" fill={color} opacity="0.35" />
        <circle cx="32" cy="4" r="3" fill={color} opacity="0.35" />
        <circle cx="4" cy="32" r="3" fill={color} opacity="0.35" />
        <circle cx="32" cy="32" r="3" fill={color} opacity="0.35" />

        {/* Cardinal nodes — 100% opacity (active endpoints) */}
        <circle cx="18" cy="4" r="3" fill={color} />
        <circle cx="4" cy="18" r="3" fill={color} />
        <circle cx="32" cy="18" r="3" fill={color} />
        <circle cx="18" cy="32" r="3" fill={color} />

        {/* Center hub — larger radius (settlement processor) */}
        <circle cx="18" cy="18" r="4.5" fill={color} />

        {/* Flow lines — connecting to center hub */}
        <line x1="18" y1="4" x2="18" y2="18" stroke={color} strokeWidth="1.5" opacity="0.4" />
        <line x1="4" y1="18" x2="18" y2="18" stroke={color} strokeWidth="1.5" opacity="0.4" />
        <line x1="18" y1="18" x2="32" y2="18" stroke={color} strokeWidth="1.5" opacity="0.4" />
        <line x1="18" y1="18" x2="18" y2="32" stroke={color} strokeWidth="1.5" opacity="0.4" />
      </g>
    </svg>
  )
}

/**
 * SettleGrid wordmark: "Settle" (bold 700) + "Grid" (regular 400).
 * On light backgrounds: "Settle" is Deep Indigo, "Grid" is Emerald.
 * On dark backgrounds: "Settle" is White, "Grid" is Emerald.
 */
function Wordmark({
  size,
  theme,
  className,
}: {
  size: number
  theme: 'light' | 'dark'
  className?: string
}) {
  const fontSize = size * 0.6
  const settleColor = theme === 'dark' ? '#FFFFFF' : '#1A1F3A'

  return (
    <span
      className={cn('select-none', className)}
      style={{
        fontSize,
        lineHeight: 1,
        fontWeight: 700,
        letterSpacing: '-0.5px',
        color: settleColor,
      }}
    >
      Settle<span style={{ color: '#10B981', fontWeight: 400 }}>Grid</span>
    </span>
  )
}

/**
 * SettleGrid logo component with three variants and theme support.
 *
 * Variants:
 * - "horizontal": Flow Grid icon + wordmark side by side (default)
 * - "compact": Smaller icon + wordmark
 * - "mark": Flow Grid icon only
 *
 * Themes:
 * - "light": For light backgrounds (Deep Indigo text + Emerald icon)
 * - "dark": For dark backgrounds (White text + Emerald icon)
 */
export function SettleGridLogo({
  variant = 'horizontal',
  theme = 'light',
  className,
  size = 32,
}: SettleGridLogoProps) {
  const iconColor = '#10B981'

  if (variant === 'mark') {
    return <FlowGrid size={size} color={iconColor} className={className} />
  }

  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <FlowGrid size={size * 0.75} color={iconColor} />
        <Wordmark size={size * 0.7} theme={theme} />
      </div>
    )
  }

  // horizontal (default)
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <FlowGrid size={size} color={iconColor} />
      <Wordmark size={size} theme={theme} />
    </div>
  )
}
