"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, useReducedMotion, animate } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  value: string
  className?: string
}

function parseLeadingNumber(value: string): number | null {
  const match = value.match(/^(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const prefersReduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const hasAnimated = useRef(false)

  const numericValue = parseLeadingNumber(value)
  const isNumeric = numericValue !== null

  useEffect(() => {
    if (!isInView || hasAnimated.current || prefersReduced) return
    hasAnimated.current = true

    if (isNumeric && numericValue !== null) {
      const controls = animate(0, numericValue, {
        duration: 1.5,
        ease: "easeOut",
        onUpdate(v) {
          setDisplay(String(Math.round(v)))
        },
      })
      return () => controls.stop()
    }
  }, [isInView, isNumeric, numericValue, prefersReduced])

  if (!isNumeric) {
    return (
      <span
        ref={ref}
        className={cn(
          "transition-opacity duration-700",
          isInView || prefersReduced ? "opacity-100" : "opacity-0",
          className,
        )}
      >
        {value}
      </span>
    )
  }

  return (
    <span ref={ref} className={className}>
      {prefersReduced ? value : display}
    </span>
  )
}
