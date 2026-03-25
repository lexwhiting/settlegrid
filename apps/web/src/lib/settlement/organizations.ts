import { db } from '@/lib/db'
import {
  organizations,
  organizationMembers,
  costAllocations,
} from '@/lib/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// ---- Types ------------------------------------------------------------------

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'
export type OrgPlan = 'free' | 'starter' | 'growth' | 'scale' | 'enterprise'

export interface CreateOrgInput {
  name: string
  slug: string
  billingEmail: string
  plan?: OrgPlan
}

// ---- Slug Validation --------------------------------------------------------

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/

export function isValidSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 63) return false
  return SLUG_RE.test(slug)
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---- Organization CRUD ------------------------------------------------------

export async function createOrganization(input: CreateOrgInput) {
  const slug = sanitizeSlug(input.slug)

  if (!isValidSlug(slug)) {
    throw new Error(
      'Invalid slug: must be 2-63 characters, lowercase alphanumeric and hyphens only, cannot start or end with a hyphen.'
    )
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: input.name,
      slug,
      billingEmail: input.billingEmail,
      plan: input.plan ?? 'free',
      settings: {},
    })
    .returning()

  logger.info('org.created', { orgId: org.id, slug: org.slug })
  return org
}

export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  return org ?? null
}

export async function getOrganizationBySlug(slug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1)
  return org ?? null
}

export async function updateOrgSettings(
  orgId: string,
  settings: Record<string, unknown>
) {
  const [updated] = await db
    .update(organizations)
    .set({ settings, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning()
  return updated ?? null
}

// ---- Budget Check -----------------------------------------------------------

export async function checkOrgBudget(
  orgId: string,
  costCents: number
): Promise<{ allowed: boolean; remainingCents: number }> {
  const org = await getOrganization(orgId)
  if (!org) {
    return { allowed: false, remainingCents: 0 }
  }

  // null budget = unlimited
  if (org.monthlyBudgetCents === null) {
    return { allowed: true, remainingCents: Infinity }
  }

  const remaining = org.monthlyBudgetCents - org.currentMonthSpendCents
  return {
    allowed: remaining >= costCents,
    remainingCents: Math.max(0, remaining),
  }
}

// ---- Membership Management --------------------------------------------------

export async function addMember(
  orgId: string,
  userId: string,
  role: OrgRole = 'member'
) {
  const [member] = await db
    .insert(organizationMembers)
    .values({
      orgId,
      userId,
      role,
    })
    .returning()

  logger.info('org.member_added', { orgId, userId, role })
  return member
}

export async function removeMember(orgId: string, userId: string) {
  const deleted = await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .returning()

  if (deleted.length > 0) {
    logger.info('org.member_removed', { orgId, userId })
  }

  return deleted.length > 0
}

export async function listMembers(orgId: string) {
  return db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, orgId))
    .limit(500)
}

export async function getMemberRole(
  orgId: string,
  userId: string
): Promise<OrgRole | null> {
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)
  return (member?.role as OrgRole) ?? null
}

// ---- Cost Allocations -------------------------------------------------------

export async function getCostAllocations(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return db
    .select()
    .from(costAllocations)
    .where(
      and(
        eq(costAllocations.orgId, orgId),
        gte(costAllocations.periodStart, sql`${periodStart.toISOString()}::timestamptz`),
        lte(costAllocations.periodEnd, sql`${periodEnd.toISOString()}::timestamptz`)
      )
    )
    .limit(1000)
}
