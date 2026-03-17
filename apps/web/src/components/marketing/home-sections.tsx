'use client'

import { ScrollReveal } from './scroll-reveal'

export function RevealSection({ children, className, delay }: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <ScrollReveal className={className} delay={delay}>
      {children}
    </ScrollReveal>
  )
}
