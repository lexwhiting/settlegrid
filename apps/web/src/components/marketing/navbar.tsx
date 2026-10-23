'use client'

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const navLinks = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Platform", href: "/platform" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
]

/**
 * Whether a Supabase session exists in this browser (null until known).
 * UI only — reads the local session, no network round trip.
 */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    try {
      const supabase = createClient()
      supabase.auth
        .getSession()
        .then(({ data }) => { if (active) setSignedIn(Boolean(data.session)) })
        .catch(() => { if (active) setSignedIn(false) })
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setSignedIn(Boolean(session))
      })
      unsubscribe = () => data.subscription.unsubscribe()
    } catch {
      // Auth client unavailable — treat as signed out
      setSignedIn(false)
    }
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return signedIn
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const signedIn = useSignedIn()
  // Hide the auth actions until the session is known, so they don't flash
  const pending = signedIn === null ? " invisible" : ""

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Wordmark */}
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/wordmark-transparent.svg"
              alt="SettleGrid"
              width={120}
              height={28}
              className="h-7 w-auto"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {signedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                {/* Sign in (returning users) */}
                <Link
                  href="/login"
                  className={`hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors${pending}`}
                >
                  Sign in
                </Link>

                {/* CTA */}
                <Link
                  href="/start"
                  className={`inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-colors${pending}`}
                >
                  Get started
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-sm">
          <nav className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              onClick={() => setOpen(false)}
              className={`text-sm text-muted-foreground hover:text-foreground transition-colors py-1 border-t border-border/50 pt-3 mt-1${pending}`}
            >
              {signedIn ? "Dashboard" : "Sign in"}
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
