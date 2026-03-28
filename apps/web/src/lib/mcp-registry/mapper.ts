/**
 * MCP Sub-Registry Data Mapper
 *
 * Transforms SettleGrid database rows into MCP v0.1 ServerDetail objects.
 */

import type {
  ServerDetail,
  SettleGridMeta,
  ServerLinks,
  Package,
  Remote,
  PricingMeta,
  ReviewMeta,
  RevenueMeta,
  DeveloperMeta,
  DeveloperReputationMeta,
  ChangelogEntry,
  VersionEntry,
  PricingTier,
} from './types'

// ─── Constants ───────────────────────────────────────────────────────────────

const REGISTRY_PREFIX = 'ai.settlegrid'
const REGISTRY_VERSION = '0.1' as const
const DESCRIPTION_MAX_LENGTH = 100
const BASE_URL = 'https://settlegrid.ai'
const MCP_ENDPOINT = `${BASE_URL}/api/mcp`
const API_BASE = `${BASE_URL}/api/v0.1`
const EXT_BASE = `${API_BASE}/x/ai.settlegrid`

// ─── Input Row Types ─────────────────────────────────────────────────────────

export interface ToolRow {
  id: string
  slug: string
  name: string
  description: string | null
  currentVersion: string
  pricingConfig: unknown
  category: string | null
  tags: unknown
  status: string
  totalInvocations: number
  totalRevenueCents: number
  verified: boolean
  healthEndpoint: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DeveloperRow {
  name: string | null
  slug: string | null
}

export interface ReputationRow {
  score: number
  uptimePct: number
  reviewAvg: number
  totalTools: number
  totalConsumers: number
}

export interface ReviewAggregateRow {
  averageRating: number
  totalReviews: number
  ratingDistribution: Record<string, number>
}

export interface ChangelogRow {
  version: string
  changeType: string
  summary: string
  details: unknown
  createdAt: Date
}

// ─── Truncation Helper ───────────────────────────────────────────────────────

function truncateDescription(description: string | null): string {
  if (!description) return ''
  if (description.length <= DESCRIPTION_MAX_LENGTH) return description
  return description.slice(0, DESCRIPTION_MAX_LENGTH - 1) + '\u2026'
}

// ─── Server Name Helpers ─────────────────────────────────────────────────────

/**
 * Builds the fully-qualified MCP server name from a tool slug.
 * Format: `ai.settlegrid/{slug}`
 */
export function buildServerName(slug: string): string {
  return `${REGISTRY_PREFIX}/${slug}`
}

/**
 * Extracts the tool slug from a fully-qualified server name.
 * Returns null if the format is invalid.
 */
export function extractSlugFromServerName(serverName: string): string | null {
  const prefix = `${REGISTRY_PREFIX}/`
  if (!serverName.startsWith(prefix)) return null
  const slug = serverName.slice(prefix.length)
  // Slug must be non-empty and contain only valid characters
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return null
  return slug
}

// ─── Tag Extraction ──────────────────────────────────────────────────────────

function extractTags(tags: unknown): readonly string[] {
  if (!Array.isArray(tags)) return []
  return tags.filter((t): t is string => typeof t === 'string')
}

// ─── Pricing Extraction ─────────────────────────────────────────────────────

function extractPricingModel(config: unknown): string | null {
  if (config && typeof config === 'object' && 'model' in config) {
    const model = (config as Record<string, unknown>).model
    if (typeof model === 'string') return model
  }
  return null
}

// ─── Link Builder ────────────────────────────────────────────────────────────

function buildServerLinks(
  serverName: string,
  slug: string,
  developerSlug: string | null,
  category: string | null,
): ServerLinks {
  const encodedName = encodeURIComponent(serverName)
  return {
    self: `${API_BASE}/servers/${encodedName}/versions/latest`,
    versions: `${API_BASE}/servers/${encodedName}/versions`,
    pricing: `${EXT_BASE}/pricing/${encodedName}`,
    reviews: `${EXT_BASE}/reviews/${encodedName}`,
    revenue: `${EXT_BASE}/revenue/${encodedName}`,
    website: `${BASE_URL}/tools/${slug}`,
    developer: developerSlug ? `${BASE_URL}/dev/${developerSlug}` : null,
    category: category ? `${BASE_URL}/api/v1/discover?category=${encodeURIComponent(category)}` : null,
  }
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

export function mapToolToServerDetail(
  tool: ToolRow,
  developer: DeveloperRow,
  reviews?: ReviewAggregateRow,
  reputation?: ReputationRow | null,
): ServerDetail {
  const packages: readonly Package[] = [
    {
      registryType: 'npm',
      identifier: `settlegrid-${tool.slug}`,
      transport: { type: 'stdio' },
    },
  ]

  const remotes: readonly Remote[] = [
    {
      type: 'streamable-http',
      url: MCP_ENDPOINT,
    },
  ]

  const pricing: PricingMeta = {
    config: tool.pricingConfig,
    model: extractPricingModel(tool.pricingConfig),
    currency: 'USD',
  }

  const reviewMeta: ReviewMeta = reviews
    ? {
        averageRating: reviews.averageRating,
        totalReviews: reviews.totalReviews,
        ratingDistribution: reviews.ratingDistribution,
      }
    : {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {},
      }

  const revenue: RevenueMeta = {
    totalInvocations: tool.totalInvocations,
    totalRevenueCents: tool.totalRevenueCents,
    verified: tool.verified,
  }

  const developerReputationMeta: DeveloperReputationMeta | null = reputation
    ? {
        score: reputation.score,
        uptimePct: reputation.uptimePct,
        reviewAvg: reputation.reviewAvg,
        totalTools: reputation.totalTools,
        totalConsumers: reputation.totalConsumers,
      }
    : null

  const developerMeta: DeveloperMeta = {
    name: developer.name,
    slug: developer.slug,
    profileUrl: developer.slug ? `${BASE_URL}/dev/${developer.slug}` : null,
    reputation: developerReputationMeta,
  }

  const name = buildServerName(tool.slug)
  const links = buildServerLinks(name, tool.slug, developer.slug, tool.category)

  const meta: SettleGridMeta = {
    registry: 'settlegrid',
    registryVersion: REGISTRY_VERSION,
    category: tool.category,
    tags: extractTags(tool.tags),
    pricing,
    reviews: reviewMeta,
    revenue,
    developer: developerMeta,
    healthEndpoint: tool.healthEndpoint,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
    _links: links,
  }

  return {
    name,
    description: truncateDescription(tool.description),
    title: tool.name,
    version: tool.currentVersion,
    websiteUrl: `${BASE_URL}/tools/${tool.slug}`,
    packages,
    remotes,
    _meta: meta,
  }
}

export function mapChangelogRow(row: ChangelogRow): ChangelogEntry {
  return {
    version: row.version,
    changeType: row.changeType,
    summary: row.summary,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
  }
}

export function mapVersionRow(row: ChangelogRow): VersionEntry {
  return {
    version: row.version,
    changeType: row.changeType,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Extracts pricing tiers from a tool's pricingConfig.
 * Returns a normalized array of tier descriptions.
 */
export function extractPricingTiers(pricingConfig: unknown): readonly PricingTier[] {
  if (!pricingConfig || typeof pricingConfig !== 'object') {
    return [
      {
        name: 'default',
        pricePerCallCents: 0,
        includedCalls: 0,
        description: 'No pricing configured',
      },
    ]
  }

  const config = pricingConfig as Record<string, unknown>

  // Handle array-style tiers
  if ('tiers' in config && Array.isArray(config.tiers)) {
    return (config.tiers as Array<Record<string, unknown>>)
      .filter((t) => t && typeof t === 'object')
      .map((t) => ({
        name: typeof t.name === 'string' ? t.name : 'unnamed',
        pricePerCallCents:
          typeof t.pricePerCallCents === 'number' && Number.isFinite(t.pricePerCallCents)
            ? t.pricePerCallCents
            : 0,
        includedCalls:
          typeof t.includedCalls === 'number' && Number.isFinite(t.includedCalls)
            ? t.includedCalls
            : 0,
        description: typeof t.description === 'string' ? t.description : '',
      }))
  }

  // Handle flat per-call pricing
  if ('pricePerCallCents' in config) {
    const price =
      typeof config.pricePerCallCents === 'number' && Number.isFinite(config.pricePerCallCents)
        ? config.pricePerCallCents
        : 0
    return [
      {
        name: 'default',
        pricePerCallCents: price,
        includedCalls: 0,
        description: 'Per-call pricing',
      },
    ]
  }

  return [
    {
      name: 'default',
      pricePerCallCents: 0,
      includedCalls: 0,
      description: 'No pricing configured',
    },
  ]
}
