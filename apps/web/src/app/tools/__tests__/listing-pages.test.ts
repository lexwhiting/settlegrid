/**
 * /tools (showcase) and /explore read active tools straight from the DB.
 * They must re-render periodically (not stay frozen at build time) and log a
 * failed query instead of silently rendering an empty list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

// The test transform emits classic React.createElement calls.
;(globalThis as { React?: typeof React }).React = React

const { mockDb, mockLogger } = vi.hoisted(() => {
  const fail = () => Promise.reject(new Error('db unavailable'))
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'from', 'innerJoin', 'where']) {
    chain[m] = vi.fn(() => chain)
  }
  // Terminal calls reject so every catch block runs.
  chain.orderBy = vi.fn(() => {
    const p = fail()
    return Object.assign(p, { limit: vi.fn(fail) })
  })
  chain.groupBy = vi.fn(fail)
  // getTotalToolCount awaits `.where(...)` directly.
  chain.then = (_res: unknown, rej: (e: unknown) => unknown) => rej(new Error('db unavailable'))
  return {
    mockDb: chain,
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

import ShowcasePage, { revalidate as showcaseRevalidate } from '@/app/tools/page'
import ExplorePage, { revalidate as exploreRevalidate } from '@/app/explore/page'

describe('public tool listing pages', () => {
  beforeEach(() => {
    mockLogger.error.mockClear()
    ;(mockDb.where as ReturnType<typeof vi.fn>).mockClear()
  })

  function renderedWhereClauses(): string[] {
    const dialect = new PgDialect()
    return (mockDb.where as ReturnType<typeof vi.fn>).mock.calls.map((c) => dialect.sqlToQuery(c[0] as SQL).sql)
  }

  it('revalidate every 5 minutes', () => {
    expect(showcaseRevalidate).toBe(300)
    expect(exploreRevalidate).toBe(300)
  })

  it('/tools logs a failed query and still renders', async () => {
    const el = await ShowcasePage()
    expect(el).toBeTruthy()
    expect(mockLogger.error).toHaveBeenCalledWith('showcase.active_tools_failed', {}, expect.any(Error))
  })

  it('/explore logs each failed query and still renders', async () => {
    const el = await ExplorePage()
    expect(el).toBeTruthy()
    const events = mockLogger.error.mock.calls.map((c) => c[0])
    expect(events).toEqual(
      expect.arrayContaining([
        'explore.category_counts_failed',
        'explore.total_tool_count_failed',
        'explore.recent_tools_failed',
      ]),
    )
  })

  it('/tools and /explore leave out tools owned by internal test accounts', async () => {
    await ShowcasePage()
    await ExplorePage()
    const clauses = renderedWhereClauses()
    expect(clauses).toHaveLength(4) // showcase list + explore counts, total, recent
    for (const clause of clauses) {
      expect(clause).toContain('"tools"."status" = $1')
      expect(clause).toContain('not exists (select 1 from "developers" "internal_test_developer"')
    }
  })
})
