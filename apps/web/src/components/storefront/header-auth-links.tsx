'use client'

import Link from 'next/link'
import { useSignedIn } from '@/components/marketing/navbar'

/**
 * Log in / Sign up, or Dashboard when signed in. Client-side so the page
 * around it can stay statically cached.
 */
export function HeaderAuthLinks() {
  const signedIn = useSignedIn()
  // Hide until the session is known, so the wrong links don't flash
  const pending = signedIn === null ? ' invisible' : ''

  if (signedIn) {
    return (
      <Link href="/dashboard" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
        Dashboard
      </Link>
    )
  }

  return (
    <>
      <Link href="/login" className={`text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:text-gray-100${pending}`}>
        Log in
      </Link>
      <Link href="/register" className={`text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark${pending}`}>
        Sign up
      </Link>
    </>
  )
}
