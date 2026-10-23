/**
 * dispatchWebhook / emitToolStatusChanged: endpoint selection and delivery
 * recording. Network delivery goes through safeFetch, which is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockSafeFetch } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  }
  return { mockDb, mockSafeFetch: vi.fn() }
})

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  webhookEndpoints: { developerId: 'developer_id', status: 'status' },
  webhookDeliveries: {},
  developers: { id: 'id', tier: 'tier' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
}))
vi.mock('@/lib/safe-egress', () => ({
  safeFetch: mockSafeFetch,
  isPublicUrlString: () => true,
}))

import { dispatchWebhook, emitToolStatusChanged } from '../webhooks'
import { and, eq } from 'drizzle-orm'

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.insert.mockReturnThis()
  mockDb.values.mockResolvedValue(undefined)
  mockSafeFetch.mockResolvedValue({ ok: true, status: 200 })
})

describe('dispatchWebhook', () => {
  it('only selects active endpoints of the developer', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'free' }])
      .mockResolvedValueOnce([])

    await dispatchWebhook('dev-1', 'tool.status_changed', { toolId: 't1' })

    expect(eq).toHaveBeenCalledWith('developer_id', 'dev-1')
    expect(eq).toHaveBeenCalledWith('status', 'active')
    expect(and).toHaveBeenCalled()
  })

  it('delivers only to endpoints subscribed to the event (array or JSON-string events)', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'free' }])
      .mockResolvedValueOnce([
        { id: 'ep-1', url: 'https://a.example.com/hook', secret: 's1', events: ['tool.status_changed'], customHeaders: null },
        { id: 'ep-2', url: 'https://b.example.com/hook', secret: 's2', events: '["tool.status_changed"]', customHeaders: null },
        { id: 'ep-3', url: 'https://c.example.com/hook', secret: 's3', events: ['invocation.completed'], customHeaders: null },
      ])

    await dispatchWebhook('dev-1', 'tool.status_changed', { toolId: 't1' })

    expect(mockSafeFetch).toHaveBeenCalledTimes(2)
    const urls = mockSafeFetch.mock.calls.map((c) => c[0])
    expect(urls).toEqual(['https://a.example.com/hook', 'https://b.example.com/hook'])
    expect(mockDb.values).toHaveBeenCalledTimes(2)
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({ endpointId: 'ep-1', event: 'tool.status_changed', status: 'delivered' }),
    )
  })

  it('never throws when the database fails', async () => {
    mockDb.limit.mockRejectedValueOnce(new Error('db down'))
    await expect(dispatchWebhook('dev-1', 'tool.status_changed', {})).resolves.toBeUndefined()
  })
})

describe('emitToolStatusChanged', () => {
  it('dispatches tool.status_changed with the tool and status transition', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'free' }])
      .mockResolvedValueOnce([
        { id: 'ep-1', url: 'https://a.example.com/hook', secret: 's1', events: ['tool.status_changed'], customHeaders: null },
      ])

    await emitToolStatusChanged({
      developerId: 'dev-1',
      toolId: 'tool-1',
      slug: 'my-tool',
      fromStatus: 'draft',
      toStatus: 'active',
    })

    expect(mockSafeFetch).toHaveBeenCalledTimes(1)
    const init = mockSafeFetch.mock.calls[0][1] as { headers: Record<string, string>; body: string }
    expect(init.headers['X-SettleGrid-Event']).toBe('tool.status_changed')
    expect(JSON.parse(init.body)).toMatchObject({
      event: 'tool.status_changed',
      data: { toolId: 'tool-1', slug: 'my-tool', name: null, fromStatus: 'draft', toStatus: 'active' },
    })
  })
})
