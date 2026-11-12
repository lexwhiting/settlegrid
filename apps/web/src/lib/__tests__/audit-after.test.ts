import { describe, it, expect, vi, beforeEach } from 'vitest'

// writeAuditLog must keep the serverless invocation alive until its insert lands:
// most callers fire and forget, and a write still in flight when the response is
// sent can be dropped.
const { mockAfter, mockValues } = vi.hoisted(() => ({
  mockAfter: vi.fn(),
  mockValues: vi.fn(),
}))
vi.mock('next/server', () => ({ after: mockAfter }))
vi.mock('@/lib/db', () => ({ db: { insert: vi.fn(() => ({ values: mockValues })) } }))
vi.mock('@/lib/db/schema', () => ({ auditLogs: {} }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { writeAuditLog } from '@/lib/audit'

const ENTRY = { developerId: 'dev-1', action: 'settings.notifications_updated', resourceType: 'developer' } as const

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValues.mockResolvedValue(undefined)
  })

  it('hands the pending write to after(), so an un-awaited call still completes', async () => {
    const p = writeAuditLog(ENTRY)
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockAfter.mock.calls[0][0]()).toBe(p) // the callback returns the same pending write
    await p
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ action: 'settings.notifications_updated' }))
  })

  it('still writes when called outside a request scope (after() throws)', async () => {
    mockAfter.mockImplementationOnce(() => {
      throw new Error('after() was called outside a request scope')
    })
    await expect(writeAuditLog(ENTRY)).resolves.toBeUndefined()
    expect(mockValues).toHaveBeenCalledTimes(1)
  })

  it('never rejects when the insert fails', async () => {
    mockValues.mockRejectedValueOnce(new Error('db down'))
    await expect(writeAuditLog(ENTRY)).resolves.toBeUndefined()
  })
})
