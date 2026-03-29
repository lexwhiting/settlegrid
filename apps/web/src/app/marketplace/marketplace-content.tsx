import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { eq, and, desc, ilike, or, sql, type SQL } from 'drizzle-orm'
import { type MarketplaceTool } from '@/components/marketplace/tool-card'
import { MarketplaceClientShell } from './marketplace-client-shell'

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

interface MarketplaceContentProps {
  /** Pre-set tool type filter (used by /marketplace/[type] pages) */
  fixedType?: string
  /** Pre-set ecosystem filter (used by /marketplace/ecosystem/[slug] pages) */
  fixedEcosystem?: string
  /** Whether to show the type tabs */
  showTypeTabs?: boolean
  /** Base path for navigation (e.g., /marketplace/mcp-servers) */
  basePath?: string
  /** Override search params (for static pages that pass them through) */
  searchParams?: Record<string, string | undefined>
}

async function getEcosystemCounts(): Promise<Map<string, number>> {
  try {
    const rows = await db
      .select({
        ecosystem: tools.sourceEcosystem,
        count: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(and(eq(tools.status, 'active'), sql`${tools.sourceEcosystem} IS NOT NULL`))
      .groupBy(tools.sourceEcosystem)

    return new Map(rows.map((r) => [r.ecosystem!, r.count]))
  } catch {
    return new Map()
  }
}

async function getTypeCounts(): Promise<Map<string, number>> {
  try {
    const rows = await db
      .select({
        toolType: tools.toolType,
        count: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .groupBy(tools.toolType)

    return new Map(rows.map((r) => [r.toolType, r.count]))
  } catch {
    return new Map()
  }
}

export async function MarketplaceContent({
  fixedType,
  fixedEcosystem,
  showTypeTabs = true,
  basePath = '/marketplace',
  searchParams = {},
}: MarketplaceContentProps = {}) {
  // Parse params
  const typeFilter = fixedType ?? searchParams.type ?? undefined
  const ecosystemFilter = fixedEcosystem ?? searchParams.ecosystem ?? undefined
  const categoryFilter = searchParams.category ?? undefined
  const searchQuery = searchParams.q ?? undefined
  const sortParam = searchParams.sort ?? 'popular'
  const pageParam = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1)
  const limitParam = Math.min(
    Math.max(parseInt(searchParams.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )

  // Build where conditions
  const conditions: SQL[] = [eq(tools.status, 'active')]

  if (typeFilter) {
    conditions.push(eq(tools.toolType, typeFilter))
  }

  if (ecosystemFilter) {
    conditions.push(eq(tools.sourceEcosystem, ecosystemFilter))
  }

  if (categoryFilter) {
    conditions.push(eq(tools.category, categoryFilter))
  }

  if (searchQuery) {
    const pattern = `%${searchQuery}%`
    conditions.push(or(ilike(tools.name, pattern), ilike(tools.description, pattern))!)
  }

  const whereClause = and(...conditions)

  // Parallel queries
  let total = 0
  let toolRows: MarketplaceTool[] = []
  let totalAll = 0
  let ecosystemCounts = new Map<string, number>()

  try {
    const [countResult, ecosystemCountsResult, , totalResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(whereClause),
      getEcosystemCounts(),
      getTypeCounts(),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(eq(tools.status, 'active')),
    ])

    total = countResult[0]?.count ?? 0
    totalAll = totalResult[0]?.count ?? 0
    ecosystemCounts = ecosystemCountsResult

    // Determine sort
    let orderBy
    switch (sortParam) {
      case 'newest':
        orderBy = desc(tools.createdAt)
        break
      case 'revenue':
        orderBy = desc(tools.totalRevenueCents)
        break
      default:
        orderBy = desc(tools.totalInvocations)
    }

    const offset = (pageParam - 1) * limitParam

    const rows = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        toolType: tools.toolType,
        sourceEcosystem: tools.sourceEcosystem,
        category: tools.category,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        verified: tools.verified,
        createdAt: tools.createdAt,
      })
      .from(tools)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limitParam)
      .offset(offset)

    toolRows = rows.map((r) => ({
      ...r,
      description: r.description,
      sourceEcosystem: r.sourceEcosystem,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
    }))
  } catch {
    // DB unavailable — show empty state
  }

  const totalPages = Math.max(Math.ceil(total / limitParam), 1)
  const ecosystemCount = ecosystemCounts.size

  return (
    <MarketplaceClientShell
      tools={toolRows}
      total={total}
      totalAll={totalAll}
      page={pageParam}
      totalPages={totalPages}
      ecosystemCount={ecosystemCount}
      activeType={fixedType}
      showTypeTabs={showTypeTabs}
      basePath={basePath}
    />
  )
}
