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
            <circle cx="4" cy="4" r="3" fill="#E5A336" opacity="0.35" />
            <circle cx="32" cy="4" r="3" fill="#E5A336" opacity="0.35" />
            <circle cx="4" cy="32" r="3" fill="#E5A336" opacity="0.35" />
            <circle cx="32" cy="32" r="3" fill="#E5A336" opacity="0.35" />
            <circle cx="18" cy="4" r="3" fill="#E5A336" />
            <circle cx="4" cy="18" r="3" fill="#E5A336" />
            <circle cx="32" cy="18" r="3" fill="#E5A336" />
            <circle cx="18" cy="32" r="3" fill="#E5A336" />
            <circle cx="18" cy="18" r="4.5" fill="#E5A336" />
            <line x1="18" y1="4" x2="18" y2="18" stroke="#E5A336" strokeWidth="1.5" opacity="0.4" />
            <line x1="4" y1="18" x2="18" y2="18" stroke="#E5A336" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="32" y2="18" stroke="#E5A336" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="18" y2="32" stroke="#E5A336" strokeWidth="1.5" opacity="0.4" />
          </g>
        </svg>
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="hidden dark:inline" aria-hidden="true">
          <g transform="translate(6,6)">
            <circle cx="4" cy="4" r="3" fill="#F5C963" opacity="0.35" />
            <circle cx="32" cy="4" r="3" fill="#F5C963" opacity="0.35" />
            <circle cx="4" cy="32" r="3" fill="#F5C963" opacity="0.35" />
            <circle cx="32" cy="32" r="3" fill="#F5C963" opacity="0.35" />
            <circle cx="18" cy="4" r="3" fill="#F5C963" />
            <circle cx="4" cy="18" r="3" fill="#F5C963" />
            <circle cx="32" cy="18" r="3" fill="#F5C963" />
            <circle cx="18" cy="32" r="3" fill="#F5C963" />
            <circle cx="18" cy="18" r="4.5" fill="#F5C963" />
            <line x1="18" y1="4" x2="18" y2="18" stroke="#F5C963" strokeWidth="1.5" opacity="0.4" />
            <line x1="4" y1="18" x2="18" y2="18" stroke="#F5C963" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="32" y2="18" stroke="#F5C963" strokeWidth="1.5" opacity="0.4" />
            <line x1="18" y1="18" x2="18" y2="32" stroke="#F5C963" strokeWidth="1.5" opacity="0.4" />
          </g>
        </svg>
      </span>
    )
  }

  const color = theme === 'dark' ? '#F5C963' : '#E5A336'
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

// Wordmark function removed — now using Recraft SVG wordmark image

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
 * - "light": Force light appearance (Deep Indigo text + darker Amber-Gold icon)
 * - "dark": Force dark appearance (White text + lighter Amber-Gold icon)
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

  // Both horizontal and compact now use the Recraft SVG wordmark
  const height = variant === 'compact' ? size * 0.7 : size * 0.8
  return (
    <img
      src="/brand/wordmark-transparent.svg"
      alt="SettleGrid"
      width={height * (916 / 180)}
      height={height}
      className={cn('inline-block', className)}
      style={{ height: `${height}px`, width: 'auto' }}
    />
  )
}
