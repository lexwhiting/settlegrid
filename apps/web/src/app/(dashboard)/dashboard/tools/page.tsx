'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs'
import { EmptyState } from '@/components/dashboard/empty-state'
import { useToast } from '@/components/ui/toast'

type PricingModelType = 'per-invocation' | 'per-token' | 'per-byte' | 'per-second' | 'tiered' | 'outcome'

interface ToolPricingConfig {
  model?: string
  defaultCostCents?: number
  perCallCents?: number
  costPerToken?: number
  costPerMB?: number
  costPerSecond?: number
  methods?: Record<string, { costCents: number }>
  outcomeConfig?: { successCostCents: number; failureCostCents: number; successCondition: string }
}

interface Tool {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  category: string | null
  verified: boolean
  totalInvocations: number
  totalRevenueCents: number
  pricingConfig: ToolPricingConfig
  createdAt: string
}

interface DeveloperProfile {
  name: string | null
  slug: string | null
}

interface TieredMethodEntry {
  name: string
  costCents: string
}

interface QualityCheckItem {
  label: string
  passed: boolean
  detail: string | null
}

const MIN_DESCRIPTION_LENGTH = 50

const PRICING_MODEL_LABELS: Record<PricingModelType, string> = {
  'per-invocation': 'Per Invocation',
  'per-token': 'Per Token',
  'per-byte': 'Per Byte',
  'per-second': 'Per Second',
  'tiered': 'Tiered (Per Method)',
  'outcome': 'Outcome-Based',
}

const PRICING_MODEL_DESCRIPTIONS: Record<PricingModelType, string> = {
  'per-invocation': 'Fixed cost per API call. Best for simple tools with predictable compute.',
  'per-token': 'Cost per token processed. Best for LLM proxies and text-generation tools.',
  'per-byte': 'Cost per megabyte transferred. Best for data services and file processing.',
  'per-second': 'Cost per second of compute time. Best for long-running tasks and batch jobs.',
  'tiered': 'Different pricing per method. Best for tools with varied operations.',
  'outcome': 'Charge only on successful outcomes. Best for search, matching, and verification tools.',
}

function getToolPricingDisplay(config: ToolPricingConfig): string {
  const model = config.model
  const defaultCost = config.defaultCostCents ?? config.perCallCents ?? 0

  // Legacy per_call format
  if (model === 'per_call' || model === 'per-invocation' || !model) {
    return `${formatCents(defaultCost)}/call`
  }
  if (model === 'per-token') {
    const tokenCost = config.costPerToken ?? 0
    return `${formatCents(defaultCost)}/1K tokens`
      + (tokenCost ? ` (${tokenCost} hundredths\u00a2/token)` : '')
  }
  if (model === 'per-byte') {
    const mbCost = config.costPerMB ?? 0
    return mbCost ? `${formatCents(mbCost)}/MB` : `${formatCents(defaultCost)}/MB`
  }
  if (model === 'per-second') {
    const secCost = config.costPerSecond ?? 0
    return secCost ? `${formatCents(secCost)}/second` : `${formatCents(defaultCost)}/second`
  }
  if (model === 'tiered') {
    const methodCount = config.methods ? Object.keys(config.methods).length : 0
    return methodCount > 0 ? `${methodCount} method${methodCount === 1 ? '' : 's'} priced` : `${formatCents(defaultCost)}/call`
  }
  if (model === 'outcome') {
    const successCost = config.outcomeConfig?.successCostCents ?? defaultCost
    return `${formatCents(successCost)} on success`
  }
  return `${formatCents(defaultCost)}/call`
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** Client-side mirror of the quality gate checks for the UI checklist. */
function buildQualityChecklist(tool: Tool, profile: DeveloperProfile): QualityCheckItem[] {
  const descLength = (tool.description ?? '').length
  const descPassed = descLength >= MIN_DESCRIPTION_LENGTH
  const pricingPassed = hasPricingConfigured(tool.pricingConfig)
  const categoryPassed = !!(tool.category && tool.category.trim() !== '')
  const profilePassed = !!(
    profile.name && profile.name.trim() !== '' &&
    profile.slug && profile.slug.trim() !== ''
  )

  return [
    {
      label: `Description at least ${MIN_DESCRIPTION_LENGTH} characters`,
      passed: descPassed,
      detail: descPassed ? null : `Currently ${descLength} characters`,
    },
    {
      label: 'Pricing configured with cost > $0',
      passed: pricingPassed,
      detail: pricingPassed ? null : 'Set a pricing model with a non-zero cost',
    },
    {
      label: 'Category selected',
      passed: categoryPassed,
      detail: categoryPassed ? null : 'Choose a category for your tool',
    },
    {
      label: 'Developer profile complete (name and slug)',
      passed: profilePassed,
      detail: profilePassed ? null : 'Go to Settings > Profile to set your name and slug',
    },
  ]
}

function hasPricingConfigured(config: ToolPricingConfig): boolean {
  if (!config || !config.model) return false
  switch (config.model) {
    case 'per-invocation':
      return (config.defaultCostCents ?? 0) > 0
    case 'per-token':
      return (config.costPerToken ?? 0) > 0
    case 'per-byte':
      return (config.costPerMB ?? 0) > 0
    case 'per-second':
      return (config.costPerSecond ?? 0) > 0
    case 'tiered': {
      if (!config.methods) return false
      const entries = Object.values(config.methods)
      return entries.length > 0 && entries.some((m) => m.costCents > 0)
    }
    case 'outcome':
      return (config.outcomeConfig?.successCostCents ?? 0) > 0
    default:
      return (config.defaultCostCents ?? 0) > 0
  }
}

interface ChangelogForm {
  version: string
  changeType: 'feature' | 'fix' | 'breaking' | 'deprecation'
  summary: string
}

const EMPTY_CHANGELOG_FORM: ChangelogForm = { version: '', changeType: 'feature', summary: '' }

export default function ToolsPage() {
  const { toast } = useToast()
  const [tools, setTools] = useState<Tool[]>([])
  const [developerProfile, setDeveloperProfile] = useState<DeveloperProfile>({ name: null, slug: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qualityFailures, setQualityFailures] = useState<string[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    defaultCostCents: '1',
    pricingModel: 'per-invocation' as PricingModelType,
    costPerToken: '10',
    costPerMB: '5',
    costPerSecond: '1',
    successCostCents: '10',
    failureCostCents: '0',
    successCondition: 'result.success === true',
  })
  const [tieredMethods, setTieredMethods] = useState<TieredMethodEntry[]>([{ name: '', costCents: '1' }])
  const [creating, setCreating] = useState(false)
  const [changelogToolId, setChangelogToolId] = useState<string | null>(null)
  const [changelogForm, setChangelogForm] = useState<ChangelogForm>(EMPTY_CHANGELOG_FORM)
  const [submittingChangelog, setSubmittingChangelog] = useState(false)

  async function fetchTools() {
    try {
      const res = await fetch('/api/tools')
      if (!res.ok) { setError('Failed to load tools'); return }
      const data = await res.json()
      setTools(data.tools ?? [])
      if (data.developerProfile) {
        setDeveloperProfile(data.developerProfile)
      }
    } catch {
      setError('Network error loading tools. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTools() }, [])

  function buildPricingConfig(): Record<string, unknown> {
    const defaultCost = parseInt(form.defaultCostCents, 10) || 0

    switch (form.pricingModel) {
      case 'per-invocation':
        return { model: 'per-invocation', defaultCostCents: defaultCost, perCallCents: defaultCost }
      case 'per-token':
        return { model: 'per-token', defaultCostCents: defaultCost, costPerToken: parseFloat(form.costPerToken) || 0 }
      case 'per-byte':
        return { model: 'per-byte', defaultCostCents: defaultCost, costPerMB: parseFloat(form.costPerMB) || 0 }
      case 'per-second':
        return { model: 'per-second', defaultCostCents: defaultCost, costPerSecond: parseFloat(form.costPerSecond) || 0 }
      case 'tiered': {
        const methods: Record<string, { costCents: number }> = {}
        for (const entry of tieredMethods) {
          const trimmed = entry.name.trim()
          if (trimmed) {
            methods[trimmed] = { costCents: parseInt(entry.costCents, 10) || 0 }
          }
        }
        return { model: 'tiered', defaultCostCents: defaultCost, methods }
      }
      case 'outcome':
        return {
          model: 'outcome',
          defaultCostCents: defaultCost,
          outcomeConfig: {
            successCostCents: parseInt(form.successCostCents, 10) || 0,
            failureCostCents: parseInt(form.failureCostCents, 10) || 0,
            successCondition: form.successCondition,
          },
        }
      default:
        return { model: 'per-invocation', defaultCostCents: defaultCost, perCallCents: defaultCost }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    setQualityFailures([])
    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description,
          pricingConfig: buildPricingConfig(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create tool')
        return
      }
      setShowCreate(false)
      setForm({
        name: '', slug: '', description: '', defaultCostCents: '1',
        pricingModel: 'per-invocation', costPerToken: '10', costPerMB: '5',
        costPerSecond: '1', successCostCents: '10', failureCostCents: '0',
        successCondition: 'result.success === true',
      })
      setTieredMethods([{ name: '', costCents: '1' }])
      fetchTools()
    } catch {
      setError('Network error creating tool. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function toggleStatus(toolId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'draft' : 'active'
    setError('')
    setQualityFailures([])
    try {
      const res = await fetch(`/api/tools/${toolId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (data.code === 'QUALITY_GATE_FAILED' && Array.isArray(data.failures)) {
          setError(data.error || 'Tool does not meet quality requirements')
          setQualityFailures(data.failures)
        } else {
          setError(data.error || 'Failed to toggle status')
        }
        return
      }
      setQualityFailures([])
      fetchTools()
    } catch {
      setError('Network error toggling status. Please try again.')
    }
  }

  async function handleChangelogSubmit(e: React.FormEvent, toolId: string) {
    e.preventDefault()
    setSubmittingChangelog(true)
    try {
      const res = await fetch(`/api/tools/${toolId}/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changelogForm),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create changelog entry')
        return
      }
      toast('Changelog entry created', 'success')
      setChangelogToolId(null)
      setChangelogForm(EMPTY_CHANGELOG_FORM)
    } catch {
      setError('Network error creating changelog entry. Please try again.')
    } finally {
      setSubmittingChangelog(false)
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Tools' },
      ]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">Tools</h1>
        <Button onClick={() => setShowCreate(!showCreate)} aria-label={showCreate ? 'Cancel tool creation' : 'Create a new tool'}>
          {showCreate ? 'Cancel' : 'New Tool'}
        </Button>
      </div>

      {/* Error banner with quality gate failures */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3" role="alert">
          <p className="font-medium">{error}</p>
          {qualityFailures.length > 0 && (
            <ul className="mt-2 space-y-1 list-disc list-inside" aria-label="Quality gate failures">
              {qualityFailures.map((failure, i) => (
                <li key={i}>{failure}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Create Tool</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tool-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input id="tool-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">A human-readable name for your tool (e.g., &apos;Code Reviewer Pro&apos;)</p>
                </div>
                <div>
                  <label htmlFor="tool-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
                  <input id="tool-slug" type="text" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">A URL-safe identifier used in the SDK and API (e.g., &apos;code-reviewer-pro&apos;). Cannot be changed later.</p>
                </div>
              </div>
              <div>
                <label htmlFor="tool-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea id="tool-desc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="flex w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand min-h-[80px]" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Describe what your tool does. This is shown to consumers in the showcase. Minimum {MIN_DESCRIPTION_LENGTH} characters to activate.</p>
              </div>

              {/* Pricing Model Selector */}
              <div className="space-y-4 rounded-lg border border-gray-200 dark:border-[#2E3148] p-4">
                <div>
                  <label htmlFor="tool-pricing-model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pricing Model</label>
                  <select
                    id="tool-pricing-model"
                    value={form.pricingModel}
                    onChange={(e) => setForm({ ...form, pricingModel: e.target.value as PricingModelType })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                  >
                    {(Object.keys(PRICING_MODEL_LABELS) as PricingModelType[]).map((model) => (
                      <option key={model} value={model}>{PRICING_MODEL_LABELS[model]}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{PRICING_MODEL_DESCRIPTIONS[form.pricingModel]}</p>
                </div>

                {/* Default Cost -- shown for all models */}
                <div className="w-48">
                  <label htmlFor="tool-cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Cost (cents)</label>
                  <input id="tool-cost" type="number" min="0" required value={form.defaultCostCents} onChange={(e) => setForm({ ...form, defaultCostCents: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {form.pricingModel === 'per-invocation' && 'Price per invocation in cents. Most AI tools charge 1-25 cents per call.'}
                    {form.pricingModel === 'per-token' && 'Fallback cost per call when token count is unavailable.'}
                    {form.pricingModel === 'per-byte' && 'Fallback cost per call when byte count is unavailable.'}
                    {form.pricingModel === 'per-second' && 'Fallback cost per call when duration is unavailable.'}
                    {form.pricingModel === 'tiered' && 'Fallback cost for methods not listed in the pricing grid.'}
                    {form.pricingModel === 'outcome' && 'Fallback cost if outcome cannot be determined.'}
                  </p>
                </div>

                {/* Per-Token fields */}
                {form.pricingModel === 'per-token' && (
                  <div className="w-48">
                    <label htmlFor="tool-cost-per-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Per Token (hundredths of a cent)</label>
                    <input id="tool-cost-per-token" type="number" min="0" step="0.01" required value={form.costPerToken} onChange={(e) => setForm({ ...form, costPerToken: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">e.g., 10 = $0.001 per token, 1 = $0.0001 per token</p>
                  </div>
                )}

                {/* Per-Byte fields */}
                {form.pricingModel === 'per-byte' && (
                  <div className="w-48">
                    <label htmlFor="tool-cost-per-mb" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Per MB (cents)</label>
                    <input id="tool-cost-per-mb" type="number" min="0" step="0.01" required value={form.costPerMB} onChange={(e) => setForm({ ...form, costPerMB: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Price in cents per megabyte transferred</p>
                  </div>
                )}

                {/* Per-Second fields */}
                {form.pricingModel === 'per-second' && (
                  <div className="w-48">
                    <label htmlFor="tool-cost-per-second" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Per Second (cents)</label>
                    <input id="tool-cost-per-second" type="number" min="0" step="0.01" required value={form.costPerSecond} onChange={(e) => setForm({ ...form, costPerSecond: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Price in cents per second of compute time</p>
                  </div>
                )}

                {/* Tiered (per-method) fields */}
                {form.pricingModel === 'tiered' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Per-Method Pricing</label>
                    <div className="space-y-2">
                      {tieredMethods.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            required
                            placeholder="method_name"
                            value={entry.name}
                            onChange={(e) => {
                              const updated = [...tieredMethods]
                              updated[index] = { ...entry, name: e.target.value }
                              setTieredMethods(updated)
                            }}
                            className="flex h-9 flex-1 rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand"
                          />
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="Cost (cents)"
                            value={entry.costCents}
                            onChange={(e) => {
                              const updated = [...tieredMethods]
                              updated[index] = { ...entry, costCents: e.target.value }
                              setTieredMethods(updated)
                            }}
                            className="flex h-9 w-32 rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand"
                          />
                          {tieredMethods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setTieredMethods(tieredMethods.filter((_, i) => i !== index))}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm px-1"
                              aria-label={`Remove method ${entry.name || index + 1}`}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTieredMethods([...tieredMethods, { name: '', costCents: '1' }])}
                      className="mt-2 text-sm text-brand hover:underline"
                    >
                      + Add method
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Define cost per method. Methods not listed will use the default cost above.</p>
                  </div>
                )}

                {/* Outcome-based fields */}
                {form.pricingModel === 'outcome' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="tool-success-cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Success Cost (cents)</label>
                        <input id="tool-success-cost" type="number" min="0" required value={form.successCostCents} onChange={(e) => setForm({ ...form, successCostCents: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Amount charged when the operation succeeds</p>
                      </div>
                      <div>
                        <label htmlFor="tool-failure-cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Failure Cost (cents)</label>
                        <input id="tool-failure-cost" type="number" min="0" required value={form.failureCostCents} onChange={(e) => setForm({ ...form, failureCostCents: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Amount charged on failure (usually 0)</p>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="tool-success-condition" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Success Condition</label>
                      <input id="tool-success-condition" type="text" required value={form.successCondition} onChange={(e) => setForm({ ...form, successCondition: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-2 text-sm font-mono text-xs focus:ring-2 focus:ring-brand" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JSONPath or field check that determines success (e.g., &apos;result.success === true&apos;)</p>
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Tool'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tools.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.181c-.348.205-.757-.113-.635-.511l1.384-4.522L2.23 10.29c-.31-.264-.147-.755.255-.786l4.629-.351 1.803-4.347c.16-.386.703-.386.862 0l1.803 4.347 4.63.351c.401.03.564.522.255.786l-3.556 3.028 1.383 4.522c.123.398-.287.716-.635.511L11.42 15.17z" />
                </svg>
              }
              title="No tools yet"
              description="Tools are the core of SettleGrid -- each one meters usage and collects revenue for your API or MCP endpoint automatically."
              onAction={() => setShowCreate(true)}
              actionLabel="Create Tool"
            />
            <div className="text-center pb-6 pt-2 space-y-4">
              {/* CLI scaffolder */}
              <div className="bg-gray-50 dark:bg-[#1A1D2E] border border-gray-200 dark:border-[#2E3148] rounded-lg mx-6 p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scaffold a complete project with billing pre-wired
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Generates an MCP server with tests, Dockerfile, README, and deploy config. 4 templates, 3 deploy targets.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-[#252836] text-brand dark:text-emerald-400 px-4 py-2 rounded-lg border border-gray-200 dark:border-[#2E3148]">
                    npx create-settlegrid-tool
                  </code>
                </div>
              </div>
              {/* Additional links */}
              <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                <p>
                  Or browse{' '}
                  <Link href="/servers" className="text-brand hover:underline">1,017 open-source templates</Link>{' '}
                  and{' '}
                  <Link href="/templates/" className="text-brand hover:underline">17 quickstart guides</Link>.
                </p>
                <p>
                  <Link href="/docs#cli-tools" className="text-brand hover:underline">View all CLI tools</Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              developerProfile={developerProfile}
              changelogToolId={changelogToolId}
              changelogForm={changelogForm}
              submittingChangelog={submittingChangelog}
              onToggleStatus={toggleStatus}
              onToggleChangelog={(toolId) => {
                if (changelogToolId === toolId) {
                  setChangelogToolId(null)
                  setChangelogForm(EMPTY_CHANGELOG_FORM)
                } else {
                  setChangelogToolId(toolId)
                  setChangelogForm(EMPTY_CHANGELOG_FORM)
                }
              }}
              onChangelogFormChange={setChangelogForm}
              onChangelogSubmit={handleChangelogSubmit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Tool Card Component ─────────────────────────────────────────────────── */

function ToolCard({
  tool,
  developerProfile,
  changelogToolId,
  changelogForm,
  submittingChangelog,
  onToggleStatus,
  onToggleChangelog,
  onChangelogFormChange,
  onChangelogSubmit,
}: {
  tool: Tool
  developerProfile: DeveloperProfile
  changelogToolId: string | null
  changelogForm: ChangelogForm
  submittingChangelog: boolean
  onToggleStatus: (id: string, status: string) => void
  onToggleChangelog: (id: string) => void
  onChangelogFormChange: (form: ChangelogForm) => void
  onChangelogSubmit: (e: React.FormEvent, toolId: string) => void
}) {
  const checklist = useMemo(
    () => buildQualityChecklist(tool, developerProfile),
    [tool, developerProfile]
  )
  const allPassed = checklist.every((c) => c.passed)
  const isDraft = tool.status === 'draft'

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-lg text-indigo dark:text-gray-100">{tool.name}</h3>
              <Badge variant={tool.status === 'active' ? 'success' : 'secondary'}>
                {tool.status}
              </Badge>
              {tool.verified && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25"
                  title="Verified: this tool has processed real invocations"
                  aria-label="Verified tool"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 0 1 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 1-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 1 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 1 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{tool.description ?? 'No description'}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Slug: <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{tool.slug}</code></span>
              <span>{tool.totalInvocations.toLocaleString()} invocations</span>
              <span>{formatCents(tool.totalRevenueCents)} revenue</span>
              <span>{getToolPricingDisplay(tool.pricingConfig)}</span>
              {tool.category && (
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-[#252836] px-2 py-0.5 text-xs">{tool.category}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleChangelog(tool.id)}
              aria-label={changelogToolId === tool.id ? 'Cancel changelog creation' : `Add changelog for ${tool.name}`}
            >
              {changelogToolId === tool.id ? 'Cancel' : 'Add Changelog'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleStatus(tool.id, tool.status)}
              aria-label={tool.status === 'active' ? `Deactivate ${tool.name}` : `Activate ${tool.name}`}
            >
              {tool.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
            <Link href={`/tools/${tool.slug}`}>
              <Button variant="ghost" size="sm" aria-label={`View ${tool.name} storefront`}>View</Button>
            </Link>
          </div>
        </div>

        {/* Quality checklist for draft tools */}
        {isDraft && !allPassed && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#2E3148]">
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
              Showcase Readiness
            </h4>
            <ul className="space-y-1.5" aria-label="Quality checklist for tool activation">
              {checklist.map((check, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {check.passed ? (
                    <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={check.passed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}>
                    {check.label}
                    {check.detail && (
                      <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">({check.detail})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Changelog creation form */}
        {changelogToolId === tool.id && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#2E3148]">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">New Changelog Entry</h4>
            <form onSubmit={(e) => onChangelogSubmit(e, tool.id)} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`cl-version-${tool.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Version</label>
                  <input
                    id={`cl-version-${tool.id}`}
                    type="text"
                    required
                    placeholder="1.2.0"
                    pattern="\d+\.\d+\.\d+"
                    value={changelogForm.version}
                    onChange={(e) => onChangelogFormChange({ ...changelogForm, version: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label htmlFor={`cl-type-${tool.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Change Type</label>
                  <select
                    id={`cl-type-${tool.id}`}
                    value={changelogForm.changeType}
                    onChange={(e) => onChangelogFormChange({ ...changelogForm, changeType: e.target.value as ChangelogForm['changeType'] })}
                    className="flex h-9 w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand"
                  >
                    <option value="feature">Feature</option>
                    <option value="fix">Fix</option>
                    <option value="breaking">Breaking</option>
                    <option value="deprecation">Deprecation</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor={`cl-summary-${tool.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Summary</label>
                <textarea
                  id={`cl-summary-${tool.id}`}
                  required
                  maxLength={500}
                  rows={2}
                  placeholder="Describe what changed..."
                  value={changelogForm.summary}
                  onChange={(e) => onChangelogFormChange({ ...changelogForm, summary: e.target.value })}
                  className="flex w-full rounded-md border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand min-h-[56px] resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">{changelogForm.summary.length}/500</p>
              </div>
              <Button type="submit" size="sm" disabled={submittingChangelog}>
                {submittingChangelog ? 'Saving...' : 'Save Entry'}
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
