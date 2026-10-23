import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { SYSTEM_DEVELOPER_SLUG, isSystemPrincipal } from '@/lib/system-principal'

/**
 * Founding Member program: the first developers to PUBLISH a tool (their first
 * tool becomes active) get founding status. Signing up alone no longer takes
 * a slot; developers granted at sign-up before this change keep their status
 * and count toward the limit.
 */
export const FOUNDING_MEMBER_LIMIT = 100

/** Serializes grants so concurrent activations can't push the count past the limit. */
const FOUNDING_LOCK_NAME = 'settlegrid:founding_member_grant'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbExecutor = typeof db | DbTransaction

export type FoundingGrantResult =
  | 'granted'
  | 'already_member'
  | 'limit_reached'
  | 'system_principal'
  | 'not_found'

/**
 * Number of founding members, excluding the system catalog principal (keyed
 * on its stable slug, as in lib/system-principal.ts).
 */
export async function countFoundingMembers(executor: DbExecutor = db): Promise<number> {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(developers)
    .where(
      and(
        eq(developers.isFoundingMember, true),
        sql`${developers.slug} IS DISTINCT FROM ${SYSTEM_DEVELOPER_SLUG}`,
      ),
    )
  return row?.count ?? 0
}

/**
 * Grants founding status to a developer if a slot is left and they don't
 * already have it. Runs under a transaction-scoped advisory lock so the
 * count-then-grant is atomic across concurrent requests.
 */
export async function grantFoundingMemberIfEligible(developerId: string): Promise<FoundingGrantResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${FOUNDING_LOCK_NAME}))`)

    const [dev] = await tx
      .select({
        id: developers.id,
        email: developers.email,
        slug: developers.slug,
        isFoundingMember: developers.isFoundingMember,
      })
      .from(developers)
      .where(eq(developers.id, developerId))
      .limit(1)

    if (!dev) return 'not_found'
    if (isSystemPrincipal(dev)) return 'system_principal'
    if (dev.isFoundingMember) return 'already_member'

    const count = await countFoundingMembers(tx)
    if (count >= FOUNDING_MEMBER_LIMIT) return 'limit_reached'

    const now = new Date()
    await tx
      .update(developers)
      .set({ isFoundingMember: true, foundingMemberAt: now, updatedAt: now })
      .where(and(eq(developers.id, developerId), eq(developers.isFoundingMember, false)))

    return 'granted'
  })
}
