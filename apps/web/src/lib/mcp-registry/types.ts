/**
 * MCP Sub-Registry v0.1 Type Definitions
 *
 * Implements the MCP (Model Context Protocol) server registry specification
 * with SettleGrid-specific extension metadata for pricing, reviews, and revenue.
 */

// ─── Transport Types ─────────────────────────────────────────────────────────

export interface StdioTransport {
  readonly type: 'stdio'
}

export interface StreamableHttpTransport {
  readonly type: 'streamable-http'
  readonly url: string
}

export type Transport = StdioTransport | StreamableHttpTransport

// ─── Package Type ────────────────────────────────────────────────────────────

export interface Package {
  readonly registryType: 'npm' | 'pypi' | 'docker' | 'crate'
  readonly identifier: string
  readonly transport: Transport
}

// ─── Remote Type ─────────────────────────────────────────────────────────────

export interface Remote {
  readonly type: 'streamable-http' | 'sse'
  readonly url: string
}

// ─── SettleGrid Extension Meta ───────────────────────────────────────────────

export interface PricingMeta {
  readonly config: unknown
  readonly model: string | null
  readonly currency: string
}

export interface ReviewMeta {
  readonly averageRating: number
  readonly totalReviews: number
  readonly ratingDistribution: Record<string, number>
}

export interface RevenueMeta {
  readonly totalInvocations: number
  readonly totalRevenueCents: number
  readonly verified: boolean
}

export interface DeveloperMeta {
  readonly name: string | null
  readonly slug: string | null
  readonly profileUrl: string | null
  readonly reputation: DeveloperReputationMeta | null
}

export interface DeveloperReputationMeta {
  readonly score: number
  readonly uptimePct: number
  readonly reviewAvg: number
  readonly totalTools: number
  readonly totalConsumers: number
}

export interface SettleGridMeta {
  readonly registry: 'settlegrid'
  readonly registryVersion: '0.1'
  readonly category: string | null
  readonly tags: readonly string[]
  readonly pricing: PricingMeta
  readonly reviews: ReviewMeta
  readonly revenue: RevenueMeta
  readonly developer: DeveloperMeta
  readonly healthEndpoint: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly _links: ServerLinks
}

export interface ServerLinks {
  readonly self: string
  readonly versions: string
  readonly pricing: string
  readonly reviews: string
  readonly revenue: string
  readonly website: string
  readonly developer: string | null
  readonly category: string | null
}

// ─── MCP Server Types ────────────────────────────────────────────────────────

export interface ServerDetail {
  readonly name: string
  readonly description: string
  readonly title: string
  readonly version: string
  readonly websiteUrl: string
  readonly packages: readonly Package[]
  readonly remotes: readonly Remote[]
  readonly _meta: SettleGridMeta
}

export interface ServerResponse {
  readonly server: ServerDetail
  readonly changelog: readonly ChangelogEntry[]
}

export interface ServerListResponse {
  readonly servers: readonly ServerDetail[]
  readonly metadata: {
    readonly nextCursor: string | null
    readonly count: number
  }
}

// ─── Changelog ───────────────────────────────────────────────────────────────

export interface ChangelogEntry {
  readonly version: string
  readonly changeType: string
  readonly summary: string
  readonly details: unknown
  readonly createdAt: string
}

// ─── Version List ────────────────────────────────────────────────────────────

export interface VersionEntry {
  readonly version: string
  readonly changeType: string
  readonly summary: string
  readonly createdAt: string
}

export interface VersionListResponse {
  readonly versions: readonly VersionEntry[]
  readonly metadata: {
    readonly nextCursor: string | null
    readonly count: number
  }
}

// ─── Extension Endpoint Types ────────────────────────────────────────────────

export interface PricingResponse {
  readonly serverName: string
  readonly pricing: PricingMeta
  readonly tiers: readonly PricingTier[]
}

export interface PricingTier {
  readonly name: string
  readonly pricePerCallCents: number
  readonly includedCalls: number
  readonly description: string
}

export interface ReviewsResponse {
  readonly serverName: string
  readonly averageRating: number
  readonly totalReviews: number
  readonly ratingDistribution: Record<string, number>
  readonly recentReviews: readonly ReviewEntry[]
}

export interface ReviewEntry {
  readonly rating: number
  readonly comment: string | null
  readonly developerResponse: string | null
  readonly createdAt: string
}

export interface RevenueResponse {
  readonly serverName: string
  readonly totalInvocations: number
  readonly totalRevenueCents: number
  readonly verified: boolean
  readonly category: string | null
}

export interface RegistryStatsResponse {
  readonly totalServers: number
  readonly totalVersions: number
  readonly totalDevelopers: number
  readonly totalInvocations: number
  readonly lastUpdated: string
  readonly _links: {
    readonly servers: string
    readonly categories: string
    readonly docs: string
  }
}
