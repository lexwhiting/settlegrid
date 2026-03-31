'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function Onboarding() {
  const [url, setUrl] = useState('')
  const router = useRouter()

  function handleGo() {
    const trimmed = url.trim()
    if (trimmed) {
      router.push(`/start?url=${encodeURIComponent(trimmed)}`)
    } else {
      router.push('/start')
    }
  }

  return (
    <section className="py-24 lg:py-32">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
          {/* Label */}
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground mb-6">
            60-Second Onboarding
          </p>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground mb-4">
            Paste. Price. Publish.
          </h2>

          {/* Description */}
          <p className="text-base text-muted-foreground leading-relaxed mb-10 max-w-lg">
            Drop in your endpoint URL. Set your per-call price. You&apos;re
            live. AI agents can find and pay for your tool immediately.
          </p>

          {/* Input form */}
          <form
            className="w-full max-w-lg mb-10"
            onSubmit={(e) => {
              e.preventDefault()
              handleGo()
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-api.com/endpoint"
                className="flex-1 h-11 px-4 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <button
                type="submit"
                className="h-11 px-6 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-colors shrink-0"
              >
                Go
              </button>
            </div>
          </form>

          {/* Steps */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>1. Paste your URL</span>
            <span className="text-border">—</span>
            <span>2. Set your price</span>
            <span className="text-border">—</span>
            <span>3. Start earning</span>
          </div>
        </div>
      </div>
    </section>
  )
}
