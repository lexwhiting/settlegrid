'use client'

import { cn } from '@/lib/utils'

interface SettleGridLogoProps {
  variant?: 'horizontal' | 'compact' | 'mark'
  theme?: 'light' | 'dark' | 'auto'
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
function FlowGrid({ size, theme, className }: { size: number; theme: 'light' | 'dark' | 'auto'; className?: string }) {
  // For 'auto' theme, render both versions and toggle with CSS dark: classes
  if (theme === 'auto') {
    return (
      <span className={cn('inline-flex', className)}>
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="dark:hidden" aria-hidden="true">
          <g transform="translate(6,6)">
            <circle cx="4" cy="4" r="3" fill="#059669" opacity="0.35" />
            <circle cx="32" cy="4" r="3" fill="#059669" opacity="0.35" />
            <circle cx="4" cy="32" r="3" fill="#059669" opacity="0.35" />
            <circle cx="32" cy="32" r="3" fill="#059669" opacity="0.35" />
            <circle cx="18" cy="4" r="3" fill="#059669" />
            <circle cx="4" cy="18" r="3" fill="#059669" />
            <circle cx="32" cy="18" r="3" fill="#059669" />
            <circle cx="18" cy="32" r="3" fill="#059669" />
            <circle cx="18" cy="18" r="4.5" fill="#059669" />
            <line x1="18" y1="4" x2="18" y2="18" stroke="#059669" strokeWidth="1.5" opacity="0.4" />
            <line x1="4" y1="18" x2="18" y2="18" stroke="#059669" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="32" y2="18" stroke="#059669" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="18" y2="32" stroke="#059669" strokeWidth="1.5" opacity="0.4" />
          </g>
        </svg>
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="hidden dark:inline" aria-hidden="true">
          <g transform="translate(6,6)">
            <circle cx="4" cy="4" r="3" fill="#34D399" opacity="0.35" />
            <circle cx="32" cy="4" r="3" fill="#34D399" opacity="0.35" />
            <circle cx="4" cy="32" r="3" fill="#34D399" opacity="0.35" />
            <circle cx="32" cy="32" r="3" fill="#34D399" opacity="0.35" />
            <circle cx="18" cy="4" r="3" fill="#34D399" />
            <circle cx="4" cy="18" r="3" fill="#34D399" />
            <circle cx="32" cy="18" r="3" fill="#34D399" />
            <circle cx="18" cy="32" r="3" fill="#34D399" />
            <circle cx="18" cy="18" r="4.5" fill="#34D399" />
            <line x1="18" y1="4" x2="18" y2="18" stroke="#34D399" strokeWidth="1.5" opacity="0.4" />
            <line x1="4" y1="18" x2="18" y2="18" stroke="#34D399" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="32" y2="18" stroke="#34D399" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="18" y2="32" stroke="#34D399" strokeWidth="1.5" opacity="0.4" />
          </g>
        </svg>
      </span>
    )
  }

  const color = theme === 'dark' ? '#34D399' : '#059669'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g transform="translate(6,6)">
        <circle cx="4" cy="4" r="3" fill={color} opacity="0.35" />
        <circle cx="32" cy="4" r="3" fill={color} opacity="0.35" />
        <circle cx="4" cy="32" r="3" fill={color} opacity="0.35" />
        <circle cx="32" cy="32" r="3" fill={color} opacity="0.35" />
        <circle cx="18" cy="4" r="3" fill={color} />
        <circle cx="4" cy="18" r="3" fill={color} />
        <circle cx="32" cy="18" r="3" fill={color} />
        <circle cx="18" cy="32" r="3" fill={color} />
        <circle cx="18" cy="18" r="4.5" fill={color} />
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
 * Auto theme: uses Tailwind dark: classes to swap colors.
 * Light: "Settle" is Deep Indigo, "Grid" is Emerald.
 * Dark: "Settle" is White, "Grid" is lighter Emerald.
 */
function Wordmark({
  size,
  theme,
  className,
}: {
  size: number
  theme: 'light' | 'dark' | 'auto'
  className?: string
}) {
  const fontSize = size * 0.6

  if (theme === 'auto') {
    return (
      <span
        className={cn('select-none text-[#1A1F3A] dark:text-white', className)}
        style={{
          fontSize,
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: '-0.5px',
        }}
      >
        Settle<span className="text-[#059669] dark:text-[#34D399]" style={{ fontWeight: 400 }}>Grid</span>
      </span>
    )
  }

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
      Settle<span style={{ color: theme === 'dark' ? '#34D399' : '#059669', fontWeight: 400 }}>Grid</span>
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
 * - "auto" (default): Responds to Tailwind dark mode automatically
 * - "light": Force light appearance (Deep Indigo text + darker Emerald icon)
 * - "dark": Force dark appearance (White text + lighter Emerald icon)
 */
export function SettleGridLogo({
  variant = 'horizontal',
  theme = 'auto',
  className,
  size = 32,
}: SettleGridLogoProps) {
  if (variant === 'mark') {
    return <FlowGrid size={size} theme={theme} className={className} />
  }

  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <FlowGrid size={size * 0.75} theme={theme} />
        <Wordmark size={size * 0.7} theme={theme} />
      </div>
    )
  }

  // horizontal (default)
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <FlowGrid size={size} theme={theme} />
      <Wordmark size={size} theme={theme} />
    </div>
  )
}
