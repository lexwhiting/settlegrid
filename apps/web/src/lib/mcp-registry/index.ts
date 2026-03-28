/**
 * MCP Sub-Registry Module
 *
 * Public API for the SettleGrid MCP server registry.
 */

// Types
export type {
  ServerDetail,
  ServerResponse,
  ServerListResponse,
  ServerLinks,
  Package,
  Remote,
  Transport,
  StdioTransport,
  StreamableHttpTransport,
  SettleGridMeta,
  PricingMeta,
  ReviewMeta,
  RevenueMeta,
  DeveloperMeta,
  DeveloperReputationMeta,
  ChangelogEntry,
  VersionEntry,
  VersionListResponse,
  PricingResponse,
  PricingTier,
  ReviewsResponse,
  ReviewEntry,
  RevenueResponse,
  RegistryStatsResponse,
} from './types'

// Mapper
export {
  mapToolToServerDetail,
  mapChangelogRow,
  mapVersionRow,
  buildServerName,
  extractSlugFromServerName,
  extractPricingTiers,
} from './mapper'
export type {
  ToolRow,
  DeveloperRow,
  ReputationRow,
  ReviewAggregateRow,
  ChangelogRow,
} from './mapper'

// Helpers
export {
  encodeCursor,
  decodeCursor,
  clampLimit,
  withMcpHeaders,
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
  isValidVersion,
  parseUpdatedSince,
  escapeLikePattern,
  sanitizeSearch,
  validateCategory,
  sanitizeTag,
} from './helpers'

// Constants
// Constants
export {
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
  MIN_PAGE_LIMIT,
  PUBLIC_CACHE_CONTROL,
  CORS_HEADERS,
  SEMVER_PATTERN,
  MAX_RECENT_REVIEWS,
  RATE_LIMIT_PREFIX,
  MAX_SEARCH_LENGTH,
  MAX_TAG_LENGTH,
  MAX_CATEGORY_LENGTH,
  VALID_CATEGORIES,
  MAX_CHANGELOG_ENTRIES,
} from './constants'
