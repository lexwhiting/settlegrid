'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SettleGridLogo } from '@/components/ui/logo'
import { Confetti } from '@/components/ui/confetti'
// Metadata is in layout.tsx

// ─── Types ───────────────────────────────────────────────────────────────────

interface DetectionResult {
  serviceType: string
  suggestedCategory: string
  suggestedName: string
  suggestedSlug: string
  suggestedDescription: string
  suggestedPriceCents: number
  suggestedPricingModel: string
  confidence: number
  tags: string[]
  pricingContext: {
    p25Cents: number
    p75Cents: number
    toolCount: number
  } | null
  probeLatencyMs: number | null
}

interface PublishResult {
  tool: {
    id: string
    name: string
    slug: string
    description: string | null
    status: string
    category: string | null
    proxyUrl: string
    toolPageUrl: string
    createdAt: string
  }
}

type Step = 'paste' | 'review' | 'success'

// ─── Service Type Labels ─────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<string, string> = {
  'mcp-tool': 'MCP Tool',
  'llm-inference': 'LLM Inference',
  'rest-api': 'REST API',
  'browser-automation': 'Browser Automation',
  'media-generation': 'Media Generation',
  'agent-service': 'Agent Service',
}

const CATEGORY_LABELS: Record<string, string> = {
  data: 'Data & APIs',
  nlp: 'Natural Language Processing',
  image: 'Image & Vision',
  code: 'Code & Development',
  search: 'Search & Discovery',
  finance: 'Finance & Payments',
  science: 'Science & Research',
  media: 'Media & Content',
  security: 'Security & Compliance',
  communication: 'Communication',
  productivity: 'Productivity',
  analytics: 'Analytics & BI',
  utility: 'Utility',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StartPage() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('paste')
  const [url, setUrl] = useState(searchParams.get('url') ?? '')
  const [analyzing, setAnalyzing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [priceCents, setPriceCents] = useState(5)
  const [editName, setEditName] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check auth status on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user)
    })
  }, [])

  // Focus input on mount
  useEffect(() => {
    if (step === 'paste' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [step])

  // ─── Analyze URL ──────────────────────────────────────────────────────────

  const analyzeUrl = useCallback(async () => {
    if (!url.trim()) return

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/tools/auto-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Analysis failed (${response.status})`)
      }

      const result: DetectionResult = await response.json()
      setDetection(result)
      setPriceCents(result.suggestedPriceCents)
      setEditName(result.suggestedName)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze URL. Please check the URL and try again.')
    } finally {
      setAnalyzing(false)
    }
  }, [url])

  // Auto-analyze if URL came from homepage paste input
  const autoAnalyzed = useRef(false)
  useEffect(() => {
    if (searchParams.get('url') && url.trim() && !autoAnalyzed.current) {
      autoAnalyzed.current = true
      analyzeUrl()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── OAuth Sign In ────────────────────────────────────────────────────────

  const handleOAuth = useCallback(async (provider: 'google' | 'github') => {
    setAuthLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/start`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setAuthLoading(false)
    }
    // If no error, the browser redirects to the OAuth provider
  }, [])

  // ─── Publish ──────────────────────────────────────────────────────────────

  const publish = useCallback(async () => {
    if (!detection) return

    // Check auth first
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    setPublishing(true)
    setError(null)

    try {
      const response = await fetch('/api/tools/quick-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          name: editName || detection.suggestedName,
          category: detection.suggestedCategory,
          pricingModel: detection.suggestedPricingModel,
          costCents: priceCents,
          description: detection.suggestedDescription,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) {
          setShowAuthModal(true)
          setPublishing(false)
          return
        }
        throw new Error(data.error || `Publish failed (${response.status})`)
      }

      const result: PublishResult = await response.json()
      setPublishResult(result)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish. Please try again.')
    } finally {
      setPublishing(false)
    }
  }, [detection, url, editName, priceCents, isAuthenticated])

  // ─── Copy to Clipboard ────────────────────────────────────────────────────

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }, [])

  // ─── Price formatting ─────────────────────────────────────────────────────

  const formatCents = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white dark:bg-[#0C0E14] relative overflow-hidden">
      {/* Confetti on success */}
      {step === 'success' && <Confetti />}

      {/* Header */}
      <header className="border-b border-gray-100 dark:border-[#2A2D3E]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SettleGridLogo className="h-7 w-7" />
            <span className="font-display font-semibold text-indigo dark:text-gray-100">SettleGrid</span>
          </Link>
          {isAuthenticated === false && (
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              Sign in
            </Link>
          )}
          {isAuthenticated && (
            <Link href="/dashboard" className="text-sm text-brand hover:text-brand-dark">
              Dashboard
            </Link>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-12 md:py-20">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Paste', 'Price', 'Publish'].map((label, i) => {
            const stepIndex = ['paste', 'review', 'success'].indexOf(step)
            const isActive = i === stepIndex
            const isDone = i < stepIndex
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`w-8 h-px ${isDone ? 'bg-brand' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isDone
                      ? 'bg-brand text-white'
                      : isActive
                        ? 'bg-brand/20 text-brand border-2 border-brand'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                  }`}>
                    {isDone ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    isActive ? 'text-indigo dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ─── Step 1: Paste ──────────────────────────────────────────── */}
        {step === 'paste' && (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-indigo dark:text-gray-100">
                Paste. Price. Publish.
              </h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Monetize any AI service in 60 seconds. No code required.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && url.trim()) analyzeUrl()
                  }}
                  placeholder="https://api.example.com/v1/search"
                  className="w-full h-14 px-5 text-lg rounded-xl border-2 border-gray-200 bg-white text-indigo placeholder:text-gray-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all dark:border-[#2A2D3E] dark:bg-[#161822] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand"
                  aria-label="Paste your API endpoint, MCP server URL, or any service URL"
                />
                {analyzing && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <Button
                onClick={analyzeUrl}
                disabled={!url.trim() || analyzing}
                size="lg"
                className="w-full h-12 text-base font-semibold bg-brand hover:bg-brand-dark text-white rounded-xl shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all"
              >
                {analyzing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing your service...
                  </span>
                ) : (
                  'Analyze'
                )}
              </Button>

              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                REST API, MCP server, LLM endpoint, or any HTTPS service
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </div>
            )}

            {/* Manual fallback link */}
            <div className="text-center pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Prefer to configure manually?{' '}
                <Link href="/dashboard/tools" className="text-brand hover:text-brand-dark underline">
                  Create a tool from the dashboard
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* ─── Step 2: Review ─────────────────────────────────────────── */}
        {step === 'review' && detection && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-indigo dark:text-gray-100">
                We detected your service
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Review the details below and adjust anything you like.
              </p>
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-6 space-y-5">
                {/* Service Type Badge */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                    {SERVICE_TYPE_LABELS[detection.serviceType] ?? detection.serviceType}
                  </span>
                  {detection.confidence >= 0.7 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      High confidence
                    </span>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-10 px-3 text-lg font-semibold rounded-md border border-gray-200 bg-white text-indigo focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-[#2A2D3E] dark:bg-[#161822] dark:text-gray-100"
                  />
                </div>

                {/* Category */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Category</span>
                  <span className="text-sm font-medium text-indigo dark:text-gray-200">
                    {CATEGORY_LABELS[detection.suggestedCategory] ?? detection.suggestedCategory}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Description</span>
                  <p className="mt-1 text-sm text-indigo dark:text-gray-200">
                    {detection.suggestedDescription}
                  </p>
                </div>

                {/* Pricing */}
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-indigo dark:text-gray-100">Price per call</span>
                    <span className="text-xl font-display font-bold text-brand">{formatCents(priceCents)}</span>
                  </div>

                  {/* Slider */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={priceCents}
                      onChange={(e) => setPriceCents(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand bg-gray-200 dark:bg-gray-700"
                      aria-label="Adjust price per call"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>$0.01</span>
                      <span>$1.00</span>
                    </div>
                  </div>

                  {/* Market context */}
                  {detection.pricingContext && detection.pricingContext.toolCount > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-lg p-3 text-sm">
                      <p className="text-amber-800 dark:text-amber-300">
                        Tools in <span className="font-medium">{CATEGORY_LABELS[detection.suggestedCategory] ?? detection.suggestedCategory}</span> charge{' '}
                        <span className="font-semibold">{formatCents(detection.pricingContext.p25Cents)}-{formatCents(detection.pricingContext.p75Cents)}</span>/call
                        {detection.pricingContext.toolCount > 0 && (
                          <span className="text-amber-600 dark:text-amber-400"> (based on {detection.pricingContext.toolCount} tools)</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Revenue projection */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Conservative', calls: 100 },
                      { label: 'Average', calls: 300 },
                      { label: 'Optimistic', calls: 1000 },
                    ].map(({ label, calls }) => (
                      <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm font-semibold text-indigo dark:text-gray-100">
                          {formatCents(priceCents * calls * 30)}<span className="text-xs font-normal text-gray-400">/mo</span>
                        </p>
                        <p className="text-xs text-gray-400">{calls}/day</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('paste')
                  setDetection(null)
                  setError(null)
                }}
                className="flex-shrink-0"
              >
                Back
              </Button>
              <Button
                onClick={publish}
                disabled={publishing || !editName.trim()}
                className="flex-1 h-12 text-base font-semibold bg-brand hover:bg-brand-dark text-white rounded-xl shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all"
              >
                {publishing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Publishing...
                  </span>
                ) : (
                  'Publish'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Success ────────────────────────────────────────── */}
        {step === 'success' && publishResult && (
          <div className="space-y-8 text-center">
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-indigo dark:text-gray-100">
                Your service is live!
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {publishResult.tool.name} is now discoverable on SettleGrid and ready for paid calls.
              </p>
            </div>

            <Card className="text-left">
              <CardContent className="p-6 space-y-4">
                {/* Tool Page URL */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Tool page
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 text-indigo dark:text-gray-200 font-mono break-all">
                      {publishResult.tool.toolPageUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(publishResult.tool.toolPageUrl, 'toolPage')}
                      className="flex-shrink-0 p-2 text-gray-400 hover:text-brand transition-colors"
                      aria-label="Copy tool page URL"
                    >
                      {copiedField === 'toolPage' ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Proxy URL */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Proxy URL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 text-indigo dark:text-gray-200 font-mono break-all">
                      {publishResult.tool.proxyUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(publishResult.tool.proxyUrl, 'proxy')}
                      className="flex-shrink-0 p-2 text-gray-400 hover:text-brand transition-colors"
                      aria-label="Copy proxy URL"
                    >
                      {copiedField === 'proxy' ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Revenue projection */}
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Revenue projection: Tools like yours earn <span className="font-semibold">{formatCents(priceCents * 300 * 30)}-{formatCents(priceCents * 1000 * 30)}</span>/month at average usage.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Smart Proxy + Achievements callout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className="bg-gray-50 dark:bg-[#161822] border border-gray-200 dark:border-[#2A2D3E] rounded-lg p-4">
                <p className="text-xs font-semibold text-brand mb-1">Smart Proxy Active</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your service is billed through the Smart Proxy. Authentication, balance checks, and metering happen automatically on every call.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-[#161822] border border-gray-200 dark:border-[#2A2D3E] rounded-lg p-4">
                <p className="text-xs font-semibold text-brand mb-1">Earn Achievements</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  First Tool Published &mdash; unlocked! Next up: First Call, First Dollar, Going Viral, and $1K Milestone.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/dashboard/settings#payouts">
                <Button variant="outline" className="w-full sm:w-auto">
                  Connect Stripe to Get Paid
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button className="w-full sm:w-auto bg-brand hover:bg-brand-dark text-white">
                  Go to Dashboard
                </Button>
              </Link>
            </div>

            <p className="text-sm text-gray-400 dark:text-gray-500">
              You can connect Stripe anytime. Revenue accrues immediately and pays out when you connect.
            </p>
          </div>
        )}

        {/* ─── Auth Modal (inline) ────────────────────────────────────── */}
        {showAuthModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#161822] rounded-2xl shadow-xl max-w-sm w-full mx-4 p-8 space-y-6">
              <div className="text-center space-y-2">
                <SettleGridLogo className="h-8 w-8 mx-auto" />
                <h2 className="text-xl font-display font-bold text-indigo dark:text-gray-100">
                  Sign up to publish
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No credit card. No approval. Free forever.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleOAuth('google')}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252836] text-sm font-medium text-indigo dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2A2D3E] transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
                <button
                  onClick={() => handleOAuth('github')}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252836] text-sm font-medium text-indigo dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2A2D3E] transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </button>
              </div>

              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
