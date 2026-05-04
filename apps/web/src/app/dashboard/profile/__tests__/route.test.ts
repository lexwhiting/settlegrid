/**
 * /dashboard/profile redirect tests.
 *
 * The "Public Profile" link in the dashboard sidebar lands here.
 * The route's only job: redirect to /dev/[slug] when the developer
 * has a published profile, otherwise to /dashboard/settings#profile
 * (the setup page). These tests pin the three branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
  return {
    mockGetUser: vi.fn(),
    mockDb,
  }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/db/schema', () => ({
  developers: {
    slug: 'slug',
    publicProfile: 'public_profile',
    supabaseUserId: 'supabase_user_id',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ field: a, value: b })),
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test'
  mockGetUser.mockReset()
  mockDb.limit.mockReset().mockResolvedValue([])
})

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3005/dashboard/profile', {
    method: 'GET',
  })
}

describe('GET /dashboard/profile', () => {
  it('redirects to /login when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { GET } = await import('../route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3005/login?next=/dashboard/profile',
    )
  })

  it('redirects to /dev/[slug] when developer has a published profile', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
    })
    mockDb.limit.mockResolvedValue([
      { slug: 'jane-doe', publicProfile: true },
    ])

    const { GET } = await import('../route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3005/dev/jane-doe',
    )
  })

  it('redirects to settings with setup=public-profile when developer has no slug', async () => {
    // The setup query param is the signal Settings reads to render
    // the "set up your public profile" banner. Without it, the
    // landing looks identical to a plain Settings click.
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-user-2' } },
    })
    mockDb.limit.mockResolvedValue([
      { slug: null, publicProfile: false },
    ])

    const { GET } = await import('../route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3005/dashboard/settings?setup=public-profile#profile',
    )
  })

  it('redirects to settings when slug is set but publicProfile=false', async () => {
    // The user has reserved a slug but their profile isn't published
    // yet — sending them to /dev/[slug] would show a "private" page,
    // which isn't what the sidebar link is for. Send them to the
    // setup tab so they can flip the publish toggle.
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-user-3' } },
    })
    mockDb.limit.mockResolvedValue([
      { slug: 'jane-doe', publicProfile: false },
    ])

    const { GET } = await import('../route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3005/dashboard/settings?setup=public-profile#profile',
    )
  })

  it('redirects to settings when no developer record exists for the user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'auth-user-4' } },
    })
    mockDb.limit.mockResolvedValue([])

    const { GET } = await import('../route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3005/dashboard/settings?setup=public-profile#profile',
    )
  })
})
