import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'

/**
 * Result of running quality gate checks before a tool can be activated.
 */
export interface QualityGateResult {
  passed: boolean
  failures: string[]
}

/**
 * Quality gate check metadata for displaying a checklist in the UI.
 */
export interface QualityCheckItem {
  label: string
  passed: boolean
  detail: string | null
}

const MIN_DESCRIPTION_LENGTH = 50

/**
 * Validates whether a tool meets all quality requirements for Showcase activation.
 *
 * Checks:
 * 1. Description minimum length (50 chars)
 * 2. Pricing must be configured with cost > $0
 * 3. Category must be set
 * 4. Developer profile must have a display name and slug
 */
export async function validateToolForActivation(
  toolId: string,
  developerId: string
): Promise<QualityGateResult> {
  const failures: string[] = []

  // Fetch tool data
  const [tool] = await db
    .select({
      description: tools.description,
      pricingConfig: tools.pricingConfig,
      category: tools.category,
    })
    .from(tools)
    .where(and(eq(tools.id, toolId), eq(tools.developerId, developerId)))
    .limit(1)

  if (!tool) {
    return { passed: false, failures: ['Tool not found.'] }
  }

  // Check 1: Description minimum
  const descLength = (tool.description ?? '').length
  if (descLength < MIN_DESCRIPTION_LENGTH) {
    failures.push(
      `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (currently ${descLength})`
    )
  }

  // Check 2: Pricing configured
  if (!hasPricingConfigured(tool.pricingConfig)) {
    failures.push('Pricing must be configured with a cost greater than $0')
  }

  // Check 3: Category set
  if (!tool.category || tool.category.trim() === '') {
    failures.push('A category must be selected')
  }

  // Fetch developer profile
  const [dev] = await db
    .select({
      name: developers.name,
      slug: developers.slug,
    })
    .from(developers)
    .where(eq(developers.id, developerId))
    .limit(1)

  // Check 4: Developer profile complete
  if (!dev || !dev.name || dev.name.trim() === '' || !dev.slug || dev.slug.trim() === '') {
    failures.push(
      'Your developer profile must have a display name and slug set (go to Settings > Profile)'
    )
  }

  return { passed: failures.length === 0, failures }
}

/**
 * Builds a quality checklist for a tool (for display in the dashboard UI).
 * Unlike validateToolForActivation, this returns per-check status rather than a pass/fail gate.
 */
export function buildQualityChecklist(tool: {
  description: string | null
  pricingConfig: unknown
  category: string | null
}, developer: {
  name: string | null
  slug: string | null
}): QualityCheckItem[] {
  const descLength = (tool.description ?? '').length
  const descPassed = descLength >= MIN_DESCRIPTION_LENGTH
  const pricingPassed = hasPricingConfigured(tool.pricingConfig)
  const categoryPassed = !!(tool.category && tool.category.trim() !== '')
  const profilePassed = !!(
    developer.name &&
    developer.name.trim() !== '' &&
    developer.slug &&
    developer.slug.trim() !== ''
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

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

interface PricingConfigShape {
  model?: string
  defaultCostCents?: number
  costPerToken?: number
  costPerMB?: number
  costPerSecond?: number
  methods?: Record<string, { costCents: number }>
  outcomeConfig?: { successCostCents: number }
}

function hasPricingConfigured(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const config = raw as PricingConfigShape

  if (!config.model) return false

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
