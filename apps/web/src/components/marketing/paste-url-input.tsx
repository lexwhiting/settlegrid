'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SCAN_PHASES = [
  'Connecting to endpoint...',
  'Probing response headers...',
  'Detecting service type...',
  'Analyzing pricing benchmarks...',
  'Generating recommendation...',
]

export function PasteUrlInput() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  // Animate progress bar and phase text while scanning
  useEffect(() => {
    if (!scanning) return

    // Smooth progress increment
    const progressTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p // cap at 92% until redirect
        return p + (92 - p) * 0.08 // ease-out curve
      })
    }, 100)

    // Rotate phase text
    const phaseTimer = setInterval(() => {
      setPhaseIdx((i) => (i + 1) % SCAN_PHASES.length)
    }, 1200)

    return () => {
      clearInterval(progressTimer)
      clearInterval(phaseTimer)
    }
  }, [scanning])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || scanning) return

    setScanning(true)
    setProgress(0)
    setPhaseIdx(0)

    try {
      // Run the auto-detect on the homepage so user sees progress
      const res = await fetch('/api/tools/auto-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      if (res.ok) {
        setProgress(100)
        // Brief pause at 100% for satisfaction, then redirect
        await new Promise((r) => setTimeout(r, 400))
      }
    } catch {
      // Even on error, redirect — /start page will handle retry
    }

    // Redirect to /start with URL pre-filled (it will use cached result or re-analyze)
    router.push(`/start?url=${encodeURIComponent(trimmed)}`)
  }

  if (scanning) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="h-14 rounded-xl border-2 border-brand/30 bg-[#161822] overflow-hidden relative">
          {/* Progress bar fill */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-brand/20 via-brand/30 to-brand/10 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
          {/* Shimmer effect */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-brand/10 to-transparent animate-shimmer"
            style={{ backgroundSize: '200% 100%' }}
          />
          {/* Phase text */}
          <div className="relative h-full flex items-center justify-center gap-3 px-5">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-brand font-medium transition-all duration-300">
              {SCAN_PHASES[phaseIdx]}
            </span>
            <span className="text-xs text-gray-500 ml-auto tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/v1/your-endpoint"
          className="w-full h-14 pl-12 pr-36 text-base rounded-xl border-2 border-[#2A2D3E] bg-[#161822] text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all"
          aria-label="Paste your API endpoint URL"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg bg-brand text-white font-semibold text-sm hover:bg-brand-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analyze →
        </button>
      </div>
    </form>
  )
}
