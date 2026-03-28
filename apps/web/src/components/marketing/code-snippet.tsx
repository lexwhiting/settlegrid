'use client'

import { useState, useEffect, useRef } from 'react'

const RAW_CODE = `// MCP Tool — one-line monetization
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'weather-api',
  pricing: { defaultCostCents: 1 },
})

const handler = sg.wrap(
  async (args: { city: string }) => {
    return await fetchWeather(args.city)
  },
  { method: 'get-forecast', costCents: 2 }
)

// REST API — middleware pattern
app.use('/api/v1',
  settlegridMiddleware({ toolSlug: 'my-api' })
)

// x402 — verify payment header
POST /api/x402/verify { paymentHeader }`

function highlightCode(code: string): React.ReactNode[] {
  const tokenPattern = /\/\/[^\n]*|'[^']*'|"[^"]*"|`[^`]*`|\b(import|from|export|const|let|var|function|async|await|return|if|else|try|catch|throw|new|interface|type|POST|app)\b/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push(code.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('//')) {
      parts.push(<span key={match.index} className="text-gray-500 italic">{token}</span>)
    } else if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
      parts.push(<span key={match.index} className="text-amber-300">{token}</span>)
    } else {
      parts.push(<span key={match.index} className="text-amber-400">{token}</span>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < code.length) {
    parts.push(code.slice(lastIndex))
  }
  return parts
}

export function CodeSnippet() {
  const [copied, setCopied] = useState(false)
  const [displayedChars, setDisplayedChars] = useState(0)
  const [isTyping, setIsTyping] = useState(true)
  const hasStarted = useRef(false)

  useEffect(() => {
    // Only run the typewriter once on mount
    if (hasStarted.current) return
    hasStarted.current = true

    if (!isTyping) return
    if (displayedChars >= RAW_CODE.length) {
      setIsTyping(false)
      return
    }
    const interval = setInterval(() => {
      setDisplayedChars((prev) => {
        const next = Math.min(prev + 3, RAW_CODE.length)
        if (next >= RAW_CODE.length) {
          clearInterval(interval)
          setIsTyping(false)
        }
        return next
      })
    }, 12)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCopy() {
    navigator.clipboard.writeText(RAW_CODE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const visibleCode = isTyping ? RAW_CODE.slice(0, displayedChars) : RAW_CODE

  return (
    <div className="bg-[#0D1117] rounded-xl p-6 text-sm font-mono text-left overflow-x-auto shadow-2xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
          <div className="w-3 h-3 rounded-full bg-green-400/80" />
          <span className="text-xs text-gray-400 ml-2">index.ts</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="text-gray-300 leading-relaxed">
        <code>{isTyping ? visibleCode : highlightCode(RAW_CODE)}</code>
        {isTyping && <span className="inline-block w-2 h-4 bg-brand animate-pulse ml-0.5 align-middle" />}
      </pre>
    </div>
  )
}
