"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TextGenerateEffectProps {
  words: string
  className?: string
  delay?: number
}

export function TextGenerateEffect({
  words,
  className,
  delay = 0,
}: TextGenerateEffectProps) {
  const prefersReduced = useReducedMotion()
  const wordArray = words.split(" ")

  if (prefersReduced) {
    return <span className={className}>{words}</span>
  }

  return (
    <span className={cn("inline", className)}>
      {wordArray.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block mr-[0.25em] last:mr-0"
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{
            duration: 0.4,
            delay: delay + i * 0.08,
            ease: "easeOut",
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}
