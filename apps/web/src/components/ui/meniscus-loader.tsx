'use client'

import { cn } from '@/lib/utils'

const sizeMap = {
  sm: { width: 20, height: 30 },
  md: { width: 32, height: 48 },
  lg: { width: 48, height: 72 },
} as const

interface MeniscusLoaderProps {
  /** Size of the loader container */
  size?: 'sm' | 'md' | 'lg'
  /** Accessible label for the loading state */
  label?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Liquid gold filling animation loader.
 * Uses the `.meniscus-loader` CSS class from globals.css.
 * Respects prefers-reduced-motion via the CSS media query in globals.css.
 */
export function MeniscusLoader({
  size = 'md',
  label = 'Loading',
  className,
}: MeniscusLoaderProps) {
  const dimensions = sizeMap[size]

  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex flex-col items-center gap-2', className)}
    >
      <div
        className="meniscus-loader"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: `0 0 ${dimensions.width / 2}px ${dimensions.width / 2}px`,
        }}
        aria-hidden="true"
      />
      {label && (
        <span className="text-xs text-gray-400 select-none">{label}</span>
      )}
    </div>
  )
}
