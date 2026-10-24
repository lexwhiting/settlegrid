/**
 * Runs the public visibility predicates against a real Postgres (pglite) with
 * the app schema pushed, so the generated SQL is executed, not just rendered.
 *
 * Tools owned by an internal test account (INTERNAL_TEST_DEVELOPER_SLUGS) are
 * left out; tools of every other owner, including the system principal that
 * owns the crawled catalog, the seed account and owners without a slug, keep
 * their normal status-based visibility.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { and, eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { marketplaceInclusionSql, excludeInternalTestToolsSql } from '../marketplace-visibility'

const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api')

const { tools, developers } = schema

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  db = drizzle(pg, { schema })
  const res = await pushSchema(schema as Record<string, unknown>, db as never)
  await res.apply()

  const [support, system, seed, external, noSlug] = await db
    .insert(developers)
    .values([
      { email: 'support@example.test', slug: 'settlegrid-support' },
      { email: 'system@example.test', slug: 'settlegrid-system' },
      { email: 'seed@example.test', slug: 'lexwhiting' },
      { email: 'ext@example.test', slug: 'ext-dev' },
      { email: 'noslug@example.test', slug: null },
    ])
    .returning({ id: developers.id })

  await db.insert(tools).values([
    { developerId: support.id, name: 'Connect test', slug: 'connect-test', status: 'active' },
    { developerId: support.id, name: 'Support draft', slug: 'support-draft', status: 'draft', listedInMarketplace: true },
    { developerId: system.id, name: 'Crawled', slug: 'crawled-listing', status: 'unclaimed' },
    { developerId: seed.id, name: 'Seed', slug: 'seed-tool', status: 'active' },
    { developerId: external.id, name: 'Listed draft', slug: 'listed-draft', status: 'draft', listedInMarketplace: true },
    { developerId: external.id, name: 'Hidden draft', slug: 'hidden-draft', status: 'draft', listedInMarketplace: false },
    { developerId: external.id, name: 'Deleted', slug: 'deleted-tool', status: 'deleted' },
    { developerId: noSlug.id, name: 'No slug owner', slug: 'no-slug-owner', status: 'active' },
  ])
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

const slugs = (rows: { slug: string }[]) => rows.map((r) => r.slug).sort()

describe('public visibility predicates (pglite)', () => {
  it('marketplaceInclusionSql keeps listed tools of other owners and drops internal test tools', async () => {
    const rows = await db.select({ slug: tools.slug }).from(tools).where(marketplaceInclusionSql())
    expect(slugs(rows)).toEqual(['crawled-listing', 'listed-draft', 'no-slug-owner', 'seed-tool'])
  }, 20_000)

  it('excludeInternalTestToolsSql works next to a status filter in a query that joins developers', async () => {
    const rows = await db
      .select({ slug: tools.slug, developerSlug: developers.slug })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.status, 'active'), excludeInternalTestToolsSql()))
    expect(slugs(rows)).toEqual(['no-slug-owner', 'seed-tool'])
  }, 20_000)

  it('does not hide internal test tools from queries that do not use the predicate', async () => {
    const [row] = await db
      .select({ slug: tools.slug, status: tools.status })
      .from(tools)
      .where(eq(tools.slug, 'connect-test'))
    expect(row).toEqual({ slug: 'connect-test', status: 'active' })
  }, 20_000)
})
