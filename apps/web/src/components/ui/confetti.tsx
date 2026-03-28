'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  width: number
  height: number
  color: string
  opacity: number
  gravity: number
}

const AMBER_GOLD_PALETTE = [
  '#E5A336', // brand
  '#C4891E', // brand-dark
  '#F5C963', // brand-light
  '#D4A574', // warm brass
  '#F59E0B', // amber-500
  '#FBBF24', // amber-400
  '#FCD34D', // amber-300
  '#B45309', // amber-700
]

const PARTICLE_COUNT = 120
const DURATION_MS = 3000
const FADE_START_MS = 2200

function createParticle(canvasWidth: number): Particle {
  const centerX = canvasWidth / 2
  const spread = canvasWidth * 0.4
  return {
    x: centerX + (Math.random() - 0.5) * spread,
    y: -10,
    vx: (Math.random() - 0.5) * 8,
    vy: Math.random() * -12 - 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    width: Math.random() * 8 + 4,
    height: Math.random() * 6 + 2,
    color: AMBER_GOLD_PALETTE[Math.floor(Math.random() * AMBER_GOLD_PALETTE.length)],
    opacity: 1,
    gravity: 0.12 + Math.random() * 0.08,
  }
}

/**
 * Canvas-based confetti celebration component.
 * Triggers amber-gold confetti on mount and auto-cleans up after 3 seconds.
 */
export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas to full viewport
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Particle[] = []
    const startTime = performance.now()

    // Burst: create all particles at once
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle(canvas.width))
    }

    function draw(now: number) {
      if (!ctx || !canvas) return

      const elapsed = now - startTime
      if (elapsed > DURATION_MS) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Global fade out near the end
      const globalAlpha = elapsed > FADE_START_MS
        ? 1 - (elapsed - FADE_START_MS) / (DURATION_MS - FADE_START_MS)
        : 1

      for (const p of particles) {
        p.vy += p.gravity
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.vx *= 0.99 // air resistance

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.opacity * globalAlpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
        ctx.restore()
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  )
}
