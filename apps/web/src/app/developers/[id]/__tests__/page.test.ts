/**
 * /developers/{id} redirects to the canonical /dev/{slug} profile.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as ReactActual from 'react'

// The project compiles JSX with the classic React.createElement transform;
// expose React as a global so the server component can be called directly.
Object.assign(globalThis, { React: ReactActual })

const { mockPermanentRedirect } = vi.hoisted(() => ({
  mockPermanentRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({ permanentRedirect: mockPermanentRedirect }))
vi.mock('@/components/ui/logo', () => ({ SettleGridLogo: () => null }))

import DeveloperProfilePage, { generateMetadata } from '../page'

const PROFILE = {
  name: 'Ada',
  slug: 'ada',
  bio: null,
  avatarUrl: null,
  joinedAt: '2026-01-01T00:00:00.000Z',
  stats: { toolCount: 1, totalInvocations: 0, avgResponseTimeMs: 0 },
  tools: [],
}

const originalFetch = global.fetch

function mockProfileResponse(body: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

describe('/developers/[id]', () => {
  it('permanently redirects to /dev/{slug}', async () => {
    mockProfileResponse({ data: PROFILE })
    await expect(
      DeveloperProfilePage({ params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }),
    ).rejects.toThrow('REDIRECT:/dev/ada')
    expect(mockPermanentRedirect).toHaveBeenCalledWith('/dev/ada')
  })

  it('does not redirect when the profile is not found', async () => {
    mockProfileResponse({ error: 'not found' }, false)
    // An id (UUID) with no profile. Slug-shaped ids redirect; see the next test.
    await DeveloperProfilePage({ params: Promise.resolve({ id: '22222222-2222-2222-2222-222222222222' }) })
    expect(mockPermanentRedirect).not.toHaveBeenCalled()
  })

  it('permanently redirects an old /developers/{slug} link to /dev/{slug} without a lookup', async () => {
    mockProfileResponse({ error: 'not found' }, false)
    await expect(
      DeveloperProfilePage({ params: Promise.resolve({ id: 'sg-e2e-test-dev' }) }),
    ).rejects.toThrow('REDIRECT:/dev/sg-e2e-test-dev')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not redirect an id that is neither a UUID nor a valid slug', async () => {
    mockProfileResponse({ error: 'not found' }, false)
    await DeveloperProfilePage({ params: Promise.resolve({ id: 'Not_A_Slug!' }) })
    expect(mockPermanentRedirect).not.toHaveBeenCalled()
  })

  it('sets the canonical URL to /dev/{slug}', async () => {
    mockProfileResponse({ data: PROFILE })
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'ada' }) })
    expect(meta.alternates?.canonical).toBe('https://settlegrid.ai/dev/ada')
  })
})
