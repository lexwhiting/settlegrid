'use client'

import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

interface GoldParticleHoverProps {
  children: React.ReactNode
  className?: string
}

/**
 * Wrapper component that spawns floating gold particles on hover.
 * Uses CSS animations (not Canvas/WebGL) for lightweight performance.
 * Automatically disables when prefers-reduced-motion is set.
 */
export function GoldParticleHover({ children, className }: GoldParticleHoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const container = containerRef.current
    if (!container) return

    // Only spawn on ~15% of mouse moves to avoid flooding
    if (Math.random() > 0.15) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const particle = document.createElement('span')
    const hue = 38 + Math.random() * 7
    const lightness = 50 + Math.random() * 20
    const size = 2 + Math.random() * 2

    particle.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:50%',
      `background:hsl(${hue}, 78%, ${lightness}%)`,
      'pointer-events:none',
      'animation:particleFloat 0.8s ease-out forwards',
      'z-index:10',
    ].join(';')

    container.appendChild(particle)

    const timer = window.setTimeout(() => {
      if (particle.parentNode === container) {
        container.removeChild(particle)
      }
    }, 800)

    // Store timeout id on the element for potential cleanup
    particle.dataset.timer = String(timer)
  }, [])

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn('relative overflow-hidden', className)}
    >
      {children}
    </div>
  )
}
