'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

interface AskResult {
  answer: string
  toolName: string
  toolSlug: string
  costDisplay: string
  error?: string
}

export default function AskSettleGridPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        if (typeof data.remaining === 'number') {
          setRemaining(data.remaining)
        }
        return
      }

      setResult(data)
      if (typeof data.remaining === 'number') {
        setRemaining(data.remaining)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4">
        <nav className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Explore Tools
            </Link>
            <Link href="/start" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <h1 className="text-4xl font-display font-bold text-gray-100">
              Ask <span className="text-brand">SettleGrid</span>
            </h1>
            <p className="text-gray-400 text-lg">
              Try AI tools free. Ask a question and see the marketplace in action.
            </p>
          </div>

          <form onSubmit={handleAsk} className="mb-8">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What's the weather in Tokyo?"
                className="flex-1 h-12 px-4 rounded-lg bg-[#161822] border border-[#2A2D3E] text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                maxLength={500}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="h-12 px-6 rounded-lg bg-brand text-white font-medium hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  'Ask'
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden">
              <div className="p-6">
                <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{result.answer}</p>
              </div>
              <div className="border-t border-[#2A2D3E] px-6 py-3 bg-[#0C0E14]/50 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  This answer used{' '}
                  <Link href={`/tools/${result.toolSlug}`} className="text-brand-text hover:underline font-medium">
                    {result.toolName}
                  </Link>{' '}
                  ({result.costDisplay}) via SettleGrid
                </p>
                <Link
                  href="/start"
                  className="text-xs text-brand-text hover:underline font-medium"
                >
                  Build tools like this
                </Link>
              </div>
            </div>
          )}

          {remaining !== null && remaining <= 1 && (
            <p className="text-center text-sm text-gray-500 mt-4">
              {remaining === 0
                ? 'You have used all your free questions for today.'
                : `${remaining} free question remaining today.`}
            </p>
          )}

          {/* Example questions */}
          {!result && !error && (
            <div className="mt-12">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 text-center">Try asking</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'What are the top MCP tools available?',
                  'How does API monetization work?',
                  'Compare per-call vs subscription billing',
                  'What payment protocols does SettleGrid support?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuestion(q)}
                    className="text-left text-sm text-gray-400 hover:text-gray-200 bg-[#161822] hover:bg-[#1E2030] border border-[#2A2D3E] rounded-lg px-4 py-3 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-16 text-center space-y-4">
            <p className="text-gray-400">
              Want to build tools like this? Start earning with per-call billing.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/start"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand text-white font-medium hover:bg-brand-dark transition-colors"
              >
                Start Earning
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#2A2D3E] text-gray-300 font-medium hover:bg-[#161822] transition-colors"
              >
                Browse Tools
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-3xl mx-auto text-center text-sm text-gray-500">
          Powered by <Link href="/" className="text-brand-text hover:text-brand-dark">SettleGrid</Link>
          {' '}&mdash; The settlement layer for the AI economy
        </div>
      </footer>
    </div>
  )
}
