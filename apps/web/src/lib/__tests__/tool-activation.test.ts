/**
 * onToolActivated (lib/tool-activation.ts): after a tool goes live it tries
 * the founding-member grant and sends the "tool published" email under the
 * `tool_published` preference key. It never throws.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockGrant, mockSendNotification, mockFirstEmail, mockStatusEmail, mockLogger } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    limit: vi.fn(),
  },
  mockGrant: vi.fn(),
  mockSendNotification: vi.fn().mockResolvedValue(undefined),
  mockFirstEmail: vi.fn(() => ({ subject: 'first', html: '<p>first</p>' })),
  mockStatusEmail: vi.fn(() => ({ subject: 'status', html: '<p>status</p>' })),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: { id: 'id', email: 'email', name: 'name' },
  tools: { developerId: 'developer_id', status: 'status' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  sql: vi.fn(() => ({ sql: true })),
}))
vi.mock('@/lib/founding', () => ({ grantFoundingMemberIfEligible: mockGrant }))
vi.mock('@/lib/notifications', () => ({ sendNotificationEmail: mockSendNotification }))
vi.mock('@/lib/email', () => ({
  firstToolPublishedEmail: mockFirstEmail,
  toolStatusChangedEmail: mockStatusEmail,
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

import { onToolActivated } from '../tool-activation'

const TOOL = {
  developerId: 'dev-1',
  toolId: 'tool-1',
  toolName: 'Example Search',
  toolSlug: 'example-search',
  fromStatus: 'draft',
}

/** where() #1 = developer lookup (chains to limit), #2 = active tool count. */
function dbSees(dev: { email: string; name: string | null } | null, activeCount: number) {
  mockDb.where.mockReturnValueOnce(mockDb).mockResolvedValueOnce([{ count: activeCount }])
  mockDb.limit.mockResolvedValueOnce(dev ? [dev] : [])
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReset()
  mockDb.limit.mockReset()
  mockGrant.mockResolvedValue('granted')
})

describe('onToolActivated', () => {
  it('grants founding status and sends the first-tool email for the first active tool', async () => {
    dbSees({ email: 'dev@example.com', name: 'Dana' }, 1)

    await onToolActivated(TOOL)

    expect(mockGrant).toHaveBeenCalledWith('dev-1')
    expect(mockFirstEmail).toHaveBeenCalledWith('Dana', 'Example Search', 'example-search')
    expect(mockStatusEmail).not.toHaveBeenCalled()
    expect(mockSendNotification).toHaveBeenCalledWith({
      developerId: 'dev-1',
      eventKey: 'tool_published',
      email: 'dev@example.com',
      subject: 'first',
      html: '<p>first</p>',
    })
  })

  it('uses the status-changed email when the developer already has another active tool', async () => {
    dbSees({ email: 'dev@example.com', name: null }, 3)

    await onToolActivated(TOOL)

    expect(mockStatusEmail).toHaveBeenCalledWith('dev@example.com', 'Example Search', 'draft', 'active')
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'tool_published', subject: 'status' }),
    )
  })

  it('still sends the email when the founding grant fails, and does not throw', async () => {
    mockGrant.mockRejectedValueOnce(new Error('lock timeout'))
    dbSees({ email: 'dev@example.com', name: 'Dana' }, 1)

    await expect(onToolActivated(TOOL)).resolves.toBeUndefined()

    expect(mockLogger.error).toHaveBeenCalledWith(
      'founding_member.grant_failed',
      expect.objectContaining({ developerId: 'dev-1' }),
      expect.any(Error),
    )
    expect(mockSendNotification).toHaveBeenCalled()
  })

  it('logs and swallows an error while preparing the email', async () => {
    mockDb.where.mockReturnValueOnce(mockDb)
    mockDb.limit.mockRejectedValueOnce(new Error('db down'))

    await expect(onToolActivated(TOOL)).resolves.toBeUndefined()

    expect(mockLogger.error).toHaveBeenCalledWith(
      'tool_published_email.failed',
      expect.objectContaining({ toolId: 'tool-1' }),
      expect.any(Error),
    )
    expect(mockSendNotification).not.toHaveBeenCalled()
  })
})
