'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface BudgetOption {
  label: string
  cents: number
}

const BUDGET_OPTIONS: BudgetOption[] = [
  { label: '$10', cents: 1000 },
  { label: '$50', cents: 5000 },
  { label: '$100', cents: 10000 },
  { label: '$500', cents: 50000 },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe / 100)
}

// ─── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const isComplete = step < current
        const isCurrent = step === current
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                isComplete && 'bg-amber-500 text-white',
                isCurrent && 'bg-brand text-white',
                !isComplete && !isCurrent && 'bg-gray-200 dark:bg-[#252836] text-gray-500 dark:text-gray-400'
              )}
            >
              {isComplete ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                step
              )}
            </div>
            {step < total && (
              <div className={cn(
                'w-8 h-0.5 transition-colors',
                step < current ? 'bg-amber-500' : 'bg-gray-200 dark:bg-[#252836]'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Welcome ────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <Card>
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
        <CardTitle className="text-2xl">Set up your agents to discover and pay for tools</CardTitle>
        <CardDescription className="text-base mt-2 max-w-lg mx-auto">
          SettleGrid connects your AI agents to a marketplace of paid tools.
          Your agents discover tools, invoke them, and pay per-call -- all through a single API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Discover',
              description: 'Your agent queries the SettleGrid directory to find tools that match its needs.',
              icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
            },
            {
              title: 'Invoke',
              description: 'Call any tool with your API key. SettleGrid handles auth, routing, and metering.',
              icon: 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z',
            },
            {
              title: 'Pay',
              description: 'Usage is deducted from your budget. Set limits so your agents never overspend.',
              icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-gray-50 dark:bg-[#252836] rounded-xl p-5 border border-gray-100 dark:border-[#2A2D3E]"
            >
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center pt-2">
          <Button onClick={onNext} size="lg">
            Get Started
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Step 2: Add Budget ─────────────────────────────────────────────────────

function StepBudget({
  onNext,
  onBack,
  selectedBudget,
  setSelectedBudget,
  customBudget,
  setCustomBudget,
}: {
  onNext: () => void
  onBack: () => void
  selectedBudget: number | null
  setSelectedBudget: (v: number | null) => void
  customBudget: string
  setCustomBudget: (v: string) => void
}) {
  const isCustom = selectedBudget !== null && !BUDGET_OPTIONS.some((o) => o.cents === selectedBudget)
  const effectiveBudget = selectedBudget

  function handleCustomChange(value: string) {
    // Allow only digits and a single dot
    const cleaned = value.replace(/[^0-9.]/g, '')
    setCustomBudget(cleaned)
    const parsed = parseFloat(cleaned)
    if (Number.isFinite(parsed) && parsed > 0) {
      setSelectedBudget(Math.round(parsed * 100))
    } else {
      setSelectedBudget(null)
    }
  }

  function selectPreset(cents: number) {
    setSelectedBudget(cents)
    setCustomBudget('')
  }

  function selectCustom() {
    setSelectedBudget(null)
    // Focus will be handled by the input
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a Monthly Budget</CardTitle>
        <CardDescription>
          Your agents can spend up to this amount per month on tool invocations.
          You can change this anytime from the Budgets page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.cents}
              type="button"
              onClick={() => selectPreset(option.cents)}
              className={cn(
                'rounded-xl border-2 py-4 px-3 text-center font-semibold transition-all',
                selectedBudget === option.cents
                  ? 'border-brand bg-brand/5 text-brand dark:bg-brand/10'
                  : 'border-gray-200 dark:border-[#2A2D3E] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#3E4168]'
              )}
            >
              <span className="text-xl">{option.label}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">/ month</span>
            </button>
          ))}
          <button
            type="button"
            onClick={selectCustom}
            className={cn(
              'rounded-xl border-2 py-4 px-3 text-center font-semibold transition-all',
              isCustom
                ? 'border-brand bg-brand/5 text-brand dark:bg-brand/10'
                : 'border-gray-200 dark:border-[#2A2D3E] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#3E4168]'
            )}
          >
            <span className="text-xl">Custom</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">/ month</span>
          </button>
        </div>

        {(isCustom || (selectedBudget === null && customBudget !== '')) && (
          <div className="flex items-center gap-3 max-w-xs">
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">$</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Enter amount"
              value={customBudget}
              onChange={(e) => handleCustomChange(e.target.value)}
              autoFocus
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">/ month</span>
          </div>
        )}

        {effectiveBudget !== null && effectiveBudget > 0 && (
          <div className="bg-gray-50 dark:bg-[#252836] rounded-lg p-4 border border-gray-100 dark:border-[#2A2D3E]">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Your agents will be able to spend up to{' '}
              <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCents(effectiveBudget)}</span>{' '}
              per month. When the limit is reached, tool calls will be rejected until the next billing period.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNext}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Skip for now
            </button>
            <Button onClick={onNext} disabled={effectiveBudget === null || effectiveBudget <= 0}>
              Continue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Step 3: API Key ────────────────────────────────────────────────────────

function StepApiKey({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Get Your API Key</CardTitle>
        <CardDescription>
          API keys authenticate your agents when they invoke tools through SettleGrid.
          Each key is scoped to a specific tool.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-50 dark:bg-[#252836] rounded-xl p-6 border border-gray-100 dark:border-[#2A2D3E] space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Create keys from the Consumer dashboard</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Browse tools, purchase credits, then generate an API key for each tool you want to use.
                Keys are shown once at creation and cannot be retrieved later.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">IP allowlisting available</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Restrict each key to specific IP addresses or CIDR ranges for additional security.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Discovery endpoint</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Your agents can discover available tools via the public directory.
              </p>
              <code className="mt-2 inline-block text-xs bg-[#0D1117] text-amber-400 px-3 py-1.5 rounded font-mono">
                GET https://settlegrid.ai/api/v1/discover
              </code>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/consumer" className="text-sm text-brand hover:underline">
            Go to Consumer Dashboard
          </Link>
          <Badge variant="secondary">Manage keys there</Badge>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Step 4: Connect Your Agent ─────────────────────────────────────────────

const DISCOVERY_SNIPPET = `// Step 1: Discover tools matching your agent's needs
const discovery = await fetch(
  'https://settlegrid.ai/api/v1/discover?q=weather',
  { headers: { 'Accept': 'application/json' } }
)
const { tools } = await discovery.json()

// Step 2: Pick a tool and invoke it with your API key
const tool = tools[0]
const result = await fetch(tool.endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.SETTLEGRID_API_KEY,
  },
  body: JSON.stringify({ location: 'New York' }),
})

const data = await result.json()
// Cost is deducted from your tool balance automatically`

const PYTHON_SNIPPET = `import httpx

# Step 1: Discover tools
discovery = httpx.get(
    "https://settlegrid.ai/api/v1/discover",
    params={"q": "weather"},
)
tools = discovery.json()["tools"]

# Step 2: Invoke with your API key
tool = tools[0]
result = httpx.post(
    tool["endpoint"],
    headers={"x-api-key": os.environ["SETTLEGRID_API_KEY"]},
    json={"location": "New York"},
)

data = result.json()
# Cost is deducted from your tool balance automatically`

function StepConnect({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const [lang, setLang] = useState<'typescript' | 'python'>('typescript')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Your Agent</CardTitle>
        <CardDescription>
          Point your AI agent at the SettleGrid discovery API, then invoke tools with your API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLang('typescript')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              lang === 'typescript'
                ? 'bg-brand text-white'
                : 'bg-gray-100 dark:bg-[#252836] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            )}
          >
            TypeScript
          </button>
          <button
            type="button"
            onClick={() => setLang('python')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              lang === 'python'
                ? 'bg-brand text-white'
                : 'bg-gray-100 dark:bg-[#252836] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            )}
          >
            Python
          </button>
        </div>

        <CopyableCodeBlock
          code={lang === 'typescript' ? DISCOVERY_SNIPPET : PYTHON_SNIPPET}
          language={lang === 'typescript' ? 'TypeScript' : 'Python'}
          title="agent-integration.ts"
        />

        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Keep your API key secret</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Store your API key in environment variables. Never commit it to source control or expose it in client-side code.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/docs"
            className="flex items-center gap-2 bg-gray-50 dark:bg-[#252836] rounded-lg p-4 border border-gray-100 dark:border-[#2A2D3E] hover:border-brand/30 transition-colors group"
          >
            <svg className="w-5 h-5 text-gray-400 group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Full Documentation</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">API reference, SDKs, and examples</p>
            </div>
          </Link>
          <Link
            href="/consumer/budgets"
            className="flex items-center gap-2 bg-gray-50 dark:bg-[#252836] rounded-lg p-4 border border-gray-100 dark:border-[#2A2D3E] hover:border-brand/30 transition-colors group"
          >
            <svg className="w-5 h-5 text-gray-400 group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Budget Dashboard</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Monitor spending and set alerts</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onFinish} size="lg">
            Go to Consumer Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const STEP_TITLES: Record<Step, string> = {
  1: 'Welcome',
  2: 'Set Budget',
  3: 'API Key',
  4: 'Connect Agent',
}

export default function ConsumerOnboardPage() {
  const [step, setStep] = useState<Step>(1)
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null)
  const [customBudget, setCustomBudget] = useState('')

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, 4) as Step)
  }, [])

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1) as Step)
  }, [])

  const handleFinish = useCallback(() => {
    // Navigate to the consumer dashboard
    window.location.href = '/consumer'
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Consumer', href: '/consumer' },
          { label: 'Onboard' },
        ]}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Consumer Onboarding
        </h1>
        <Badge variant="outline">{STEP_TITLES[step]}</Badge>
      </div>

      <div className="flex justify-center">
        <StepIndicator current={step} total={4} />
      </div>

      {step === 1 && <StepWelcome onNext={goNext} />}
      {step === 2 && (
        <StepBudget
          onNext={goNext}
          onBack={goBack}
          selectedBudget={selectedBudget}
          setSelectedBudget={setSelectedBudget}
          customBudget={customBudget}
          setCustomBudget={setCustomBudget}
        />
      )}
      {step === 3 && <StepApiKey onNext={goNext} onBack={goBack} />}
      {step === 4 && <StepConnect onBack={goBack} onFinish={handleFinish} />}
    </div>
  )
}
