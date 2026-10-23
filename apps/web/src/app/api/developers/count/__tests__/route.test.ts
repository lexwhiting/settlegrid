import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCount, mockLogger } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/founding', () => ({ countFoundingMembers: mockCount }))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

import { GET } from '../route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/developers/count', () => {
  it('returns the number of founding members', async () => {
    mockCount.mockResolvedValueOnce(37)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: 37 })
  })

  it('returns null (not 0) and logs when the count fails', async () => {
    mockCount.mockRejectedValueOnce(new Error('db down'))

    const res = await GET()

    expect(await res.json()).toEqual({ count: null })
    expect(mockLogger.error).toHaveBeenCalledWith('developers.count_failed', {}, expect.any(Error))
  })
})
