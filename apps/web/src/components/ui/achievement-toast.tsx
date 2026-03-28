'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import type { BadgeDefinition } from '@/lib/achievements'

/**
 * Show a celebratory toast for a newly unlocked achievement badge.
 * Uses Sonner for consistent positioning and auto-dismiss.
 */
export function showAchievementToast(badge: BadgeDefinition) {
  toast.custom(
    (id) => (
      <div
        role="alert"
        aria-live="polite"
        className="flex items-start gap-3 w-full max-w-sm rounded-lg border-2 border-amber-500/60 bg-white dark:bg-[#161822] px-4 py-3.5 shadow-lg shadow-amber-500/10"
      >
        {/* Badge icon */}
        <span className="text-2xl shrink-0 mt-0.5" aria-hidden="true">
          {badge.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-0.5">
            Achievement Unlocked
          </p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {badge.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
            {badge.description}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => toast.dismiss(id)}
          className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss achievement notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ),
    {
      duration: 5000,
      position: 'top-right',
    }
  )
}

/**
 * Hook that returns a function to show achievement toasts.
 * Useful in components that need to trigger toasts after API calls.
 */
export function useAchievementToast() {
  const showToast = useCallback((badge: BadgeDefinition) => {
    showAchievementToast(badge)
  }, [])

  return { showAchievementToast: showToast }
}

/**
 * Show multiple achievement toasts in sequence with a stagger delay.
 * Prevents overwhelming the user when multiple badges unlock at once.
 */
export function showAchievementToasts(badges: BadgeDefinition[]) {
  const STAGGER_MS = 800

  badges.forEach((badge, index) => {
    setTimeout(() => {
      showAchievementToast(badge)
    }, index * STAGGER_MS)
  })
}
