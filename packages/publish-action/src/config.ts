/**
 * SettleGrid config schema and validation.
 *
 * Validates the contents of a settlegrid.config.json file before
 * publishing to the SettleGrid registry.
 */

export const VALID_PRICING_MODELS = [
  'per-invocation',
  'per-token',
  'per-byte',
  'per-second',
  'tiered',
  'outcome',
] as const

export type PricingModel = (typeof VALID_PRICING_MODELS)[number]

export interface PricingConfig {
  model: PricingModel
  defaultCostCents?: number
  currencyCode?: string
  costPerToken?: number
  costPerMB?: number
  costPerSecond?: number
  methods?: Record<
    string,
    {
      costCents: number
      unitType?: string
      displayName?: string
    }
  >
  tiers?: Array<{
    upTo: number
    costCents: number
  }>
  outcomeConfig?: {
    successCostCents: number
    failureCostCents?: number
    successCondition?: string
  }
}

export interface SettleGridConfig {
  name: string
  slug: string
  description: string
  category: string
  version: string
  pricing: PricingConfig
  healthEndpoint?: string
  tags?: string[]
}

interface ValidationError {
  field: string
  message: string
}

const SLUG_RE = /^[a-z0-9-]+$/
const SEMVER_RE = /^\d+\.\d+\.\d+$/

/**
 * Validates a parsed settlegrid.config.json object.
 * Returns { valid: true, config } on success or { valid: false, errors } on failure.
 */
export function validateConfig(raw: unknown): {
  valid: true
  config: SettleGridConfig
} | {
  valid: false
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: [{ field: 'root', message: 'Config must be a JSON object' }],
    }
  }

  const obj = raw as Record<string, unknown>

  // --- Required string fields ---

  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name is required and must be a non-empty string' })
  } else if (obj.name.length > 200) {
    errors.push({ field: 'name', message: 'name must be 200 characters or fewer' })
  }

  if (typeof obj.slug !== 'string' || obj.slug.trim().length === 0) {
    errors.push({ field: 'slug', message: 'slug is required and must be a non-empty string' })
  } else if (!SLUG_RE.test(obj.slug)) {
    errors.push({
      field: 'slug',
      message: 'slug must contain only lowercase letters, numbers, and hyphens',
    })
  } else if (obj.slug.length > 100) {
    errors.push({ field: 'slug', message: 'slug must be 100 characters or fewer' })
  }

  if (typeof obj.description !== 'string' || obj.description.trim().length === 0) {
    errors.push({
      field: 'description',
      message: 'description is required and must be a non-empty string',
    })
  } else if (obj.description.length > 2000) {
    errors.push({ field: 'description', message: 'description must be 2000 characters or fewer' })
  }

  if (typeof obj.category !== 'string' || obj.category.trim().length === 0) {
    errors.push({
      field: 'category',
      message: 'category is required and must be a non-empty string',
    })
  }

  if (typeof obj.version !== 'string' || obj.version.trim().length === 0) {
    errors.push({ field: 'version', message: 'version is required and must be a non-empty string' })
  } else if (!SEMVER_RE.test(obj.version)) {
    errors.push({
      field: 'version',
      message: 'version must be valid semver (e.g. 1.0.0)',
    })
  }

  // --- Pricing ---

  if (obj.pricing === null || typeof obj.pricing !== 'object' || Array.isArray(obj.pricing)) {
    errors.push({ field: 'pricing', message: 'pricing is required and must be an object' })
  } else {
    const pricing = obj.pricing as Record<string, unknown>

    if (
      typeof pricing.model !== 'string' ||
      !(VALID_PRICING_MODELS as readonly string[]).includes(pricing.model)
    ) {
      errors.push({
        field: 'pricing.model',
        message: `pricing.model must be one of: ${VALID_PRICING_MODELS.join(', ')}`,
      })
    } else {
      // Model-specific validation
      switch (pricing.model) {
        case 'per-invocation':
          if (typeof pricing.defaultCostCents !== 'number' || pricing.defaultCostCents < 0) {
            errors.push({
              field: 'pricing.defaultCostCents',
              message: 'per-invocation model requires defaultCostCents (non-negative number)',
            })
          }
          break
        case 'per-token':
          if (typeof pricing.costPerToken !== 'number' || pricing.costPerToken < 0) {
            errors.push({
              field: 'pricing.costPerToken',
              message: 'per-token model requires costPerToken (non-negative number)',
            })
          }
          break
        case 'per-byte':
          if (typeof pricing.costPerMB !== 'number' || pricing.costPerMB < 0) {
            errors.push({
              field: 'pricing.costPerMB',
              message: 'per-byte model requires costPerMB (non-negative number)',
            })
          }
          break
        case 'per-second':
          if (typeof pricing.costPerSecond !== 'number' || pricing.costPerSecond < 0) {
            errors.push({
              field: 'pricing.costPerSecond',
              message: 'per-second model requires costPerSecond (non-negative number)',
            })
          }
          break
        case 'tiered':
          if (
            pricing.methods === null ||
            typeof pricing.methods !== 'object' ||
            Array.isArray(pricing.methods) ||
            Object.keys(pricing.methods as object).length === 0
          ) {
            errors.push({
              field: 'pricing.methods',
              message: 'tiered model requires methods object with at least one method',
            })
          }
          break
        case 'outcome':
          if (
            pricing.outcomeConfig === null ||
            typeof pricing.outcomeConfig !== 'object' ||
            Array.isArray(pricing.outcomeConfig)
          ) {
            errors.push({
              field: 'pricing.outcomeConfig',
              message: 'outcome model requires outcomeConfig object',
            })
          } else {
            const oc = pricing.outcomeConfig as Record<string, unknown>
            if (typeof oc.successCostCents !== 'number' || oc.successCostCents < 0) {
              errors.push({
                field: 'pricing.outcomeConfig.successCostCents',
                message: 'outcomeConfig requires successCostCents (non-negative number)',
              })
            }
          }
          break
      }
    }
  }

  // --- Optional fields ---

  if (obj.healthEndpoint !== undefined) {
    if (typeof obj.healthEndpoint !== 'string') {
      errors.push({ field: 'healthEndpoint', message: 'healthEndpoint must be a string URL' })
    } else {
      try {
        new URL(obj.healthEndpoint)
      } catch {
        errors.push({ field: 'healthEndpoint', message: 'healthEndpoint must be a valid URL' })
      }
    }
  }

  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags)) {
      errors.push({ field: 'tags', message: 'tags must be an array of strings' })
    } else {
      const invalidTags = obj.tags.filter((t: unknown) => typeof t !== 'string')
      if (invalidTags.length > 0) {
        errors.push({ field: 'tags', message: 'all tags must be strings' })
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    config: obj as unknown as SettleGridConfig,
  }
}
