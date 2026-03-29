'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface GoldBurstProps {
  /** When true, plays the gold burst animation once */
  trigger: boolean
  /** Additional CSS classes */
  className?: string
  /** Content to wrap with the burst effect */
  children?: React.ReactNode
}

/**
 * A component that triggers the gold burst animation once.
 * Uses the `.gold-burst` CSS class from globals.css.
 * Auto-removes the animation class after it completes.
 * Respects prefers-reduced-motion (CSS hides the ::after pseudo-element).
 */
export function GoldBurst({ trigger, className, children }: GoldBurstProps) {
  const [active, setActive] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    if (trigger && !hasTriggeredRef.current) {
      // Check reduced motion preference
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return
      }

      hasTriggeredRef.current = true
      setActive(true)

      // The goldBurst animation is 0.6s; remove class after it completes
      const timer = window.setTimeout(() => {
        setActive(false)
      }, 650)

      return () => {
        window.clearTimeout(timer)
      }
    }

    // Reset when trigger goes back to false so it can fire again
    if (!trigger) {
      hasTriggeredRef.current = false
    }
  }, [trigger])

  return (
    <div
      ref={containerRef}
      className={cn(active && 'gold-burst', className)}
    >
      {children}
    </div>
  )
}
