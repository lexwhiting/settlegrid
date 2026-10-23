/**
 * /dev/{slug}: the Uptime stat shows '--' when the developer has no health
 * checks (the cached reputation row stores 0 in that case).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactActual from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The project compiles JSX with the classic React.createElement transform;
// expose React as a global so the server component can be called directly.
Object.assign(globalThis, { React: ReactActual })

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: { slug: 'slug', publicProfile: 'public_profile' },
  tools: {
    name: 'name', slug: 'slug', description: 'description', category: 'category',
    currentVersion: 'current_version', totalInvocations: 'total_invocations',
    totalRevenueCents: 'total_revenue_cents', developerId: 'developer_id', status: 'status',
  },
  developerReputation: {
    developerId: 'developer_id', score: 'score', uptimePct: 'uptime_pct', reviewAvg: 'review_avg',
    totalTools: 'total_tools', totalConsumers: 'total_consumers',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
}))
vi.mock('@/lib/developer-health', () => ({ hasRecentHealthChecksSql: vi.fn(() => ({ exists: true })) }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    ReactActual.createElement('a', { href, ...rest }, children as never),
}))
vi.mock('@/components/ui/logo', () => ({ SettleGridLogo: () => null }))
vi.mock('@/components/ui/copyable-code-block', () => ({ CopyableCodeBlock: () => null }))

import DevProfilePage from '../page'

const DEVELOPER = {
  id: 'dev-1', name: 'Ada Lovelace', slug: 'ada', publicProfile: true, publicBio: null,
  avatarUrl: null, createdAt: new Date('2026-01-01'),
}
const REPUTATION = { score: 40, uptimePct: 0, reviewAvg: 0, totalTools: 1, totalConsumers: 0 }

async function render(hasChecks: boolean, uptimePct = 0): Promise<string> {
  mockDb.limit
    .mockResolvedValueOnce([DEVELOPER])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...REPUTATION, uptimePct, hasChecks }])
  const element = await DevProfilePage({ params: Promise.resolve({ slug: 'ada' }) })
  return renderToStaticMarkup(element)
}

function uptimeValue(html: string): string | undefined {
  return html.match(/>([^<]*)<\/p><p[^>]*>Uptime<\/p>/)?.[1]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
})

describe('/dev/[slug] uptime stat', () => {
  it("shows '--' when the developer has no health checks", async () => {
    expect(uptimeValue(await render(false))).toBe('--')
  })

  it('shows the cached percentage when checks exist', async () => {
    expect(uptimeValue(await render(true, 98))).toBe('98%')
  })
})
