'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PasteUrlInput() {
  const [url, setUrl] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    router.push(`/start?url=${encodeURIComponent(trimmed)}`)
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
