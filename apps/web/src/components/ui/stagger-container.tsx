"use client"

import { Children, type ReactNode } from "react"
import { motion, useReducedMotion, type Variants } from "framer-motion"

interface StaggerContainerProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
}

const containerVariants: Variants = {
  hidden: {},
  visible: (delay: number) => ({
    transition: { staggerChildren: delay },
  }),
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
}: StaggerContainerProps) {
  const prefersReduced = useReducedMotion()

  if (prefersReduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      custom={staggerDelay}
    >
      {Children.map(children, (child) => (
        <motion.div variants={itemVariants}>{child}</motion.div>
      ))}
    </motion.div>
  )
}
