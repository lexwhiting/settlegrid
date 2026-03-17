'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 to a target value using requestAnimationFrame.
 * Uses easeOutCubic easing for a natural deceleration effect.
 *
 * @param target - The final number to animate to
 * @param duration - Animation duration in milliseconds (default: 800)
 * @param enabled - Whether the animation is enabled (default: true)
 * @returns The current animated value
 */
export function useCountUp(target: number, duration: number = 800, enabled: boolean = true): number {
  const [current, setCurrent] = useState(enabled ? 0 : target)
  const startTime = useRef<number | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || target === 0) {
      setCurrent(target)
      return
    }

    startTime.current = null

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      // easeOutCubic: decelerates smoothly to a stop
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step)
      }
    }

    animationRef.current = requestAnimationFrame(step)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [target, duration, enabled])

  return current
}
