import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup (hoisted) ---------------------------------------------------

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  complianceExports: {
    id: 'id',
    requestType: 'request_type',
    entityType: 'entity_type',
    entityId: 'entity_id',
    status: 'status',
    resultUrl: 'result_url',
    completedAt: 'completed_at',
    createdAt: 'created_at',
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
}))

// ---- Imports ----------------------------------------------------------------

import {
  requestDataExport,
  requestDataDeletion,
  getExportStatus,
} from '@/lib/settlement/compliance'

// ---- Tests ------------------------------------------------------------------

describe('requestDataExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a data export request for a customer', async () => {
    mockDb.returning.mockResolvedValueOnce([
      { id: 'export-1', status: 'pending' },
    ])

    const result = await requestDataExport('customer', 'cust-123')

    expect(result).toEqual({ id: 'export-1', status: 'pending' })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'data-export',
        entityType: 'customer',
        entityId: 'cust-123',
        status: 'pending',
      })
    )
  })

  it('creates a data export request for a provider', async () => {
    mockDb.returning.mockResolvedValueOnce([
      { id: 'export-2', status: 'pending' },
    ])

    const result = await requestDataExport('provider', 'prov-456')

    expect(result).toEqual({ id: 'export-2', status: 'pending' })
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'provider',
        entityId: 'prov-456',
      })
    )
  })

  it('returns the export ID and initial status', async () => {
    mockDb.returning.mockResolvedValueOnce([
      { id: 'export-3', status: 'pending' },
    ])

    const result = await requestDataExport('customer', 'cust-789')

    expect(result.id).toBe('export-3')
    expect(result.status).toBe('pending')
  })
})

describe('requestDataDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a data deletion request for a customer', async () => {
    mockDb.returning.mockResolvedValueOnce([
      { id: 'del-1', status: 'pending' },
    ])

    const result = await requestDataDeletion('customer', 'cust-123')

    expect(result).toEqual({ id: 'del-1', status: 'pending' })
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'data-deletion',
        entityType: 'customer',
        entityId: 'cust-123',
        status: 'pending',
      })
    )
  })

  it('creates a data deletion request for a provider', async () => {
    mockDb.returning.mockResolvedValueOnce([
      { id: 'del-2', status: 'pending' },
    ])

    const result = await requestDataDeletion('provider', 'prov-456')

    expect(result).toEqual({ id: 'del-2', status: 'pending' })
  })

  it('returns pending status on creation', async () => {
    mockDb.returning.mockResolvedValueOnce([
      { id: 'del-3', status: 'pending' },
    ])

    const result = await requestDataDeletion('customer', 'cust-999')

    expect(result.status).toBe('pending')
  })
})

describe('getExportStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns export status when found', async () => {
    const mockExport = {
      id: 'export-1',
      requestType: 'data-export',
      entityType: 'customer',
      entityId: 'cust-123',
      status: 'completed',
      resultUrl: 'https://storage.example.com/export.json',
      completedAt: new Date('2026-03-15'),
      createdAt: new Date('2026-03-14'),
    }
    mockDb.limit.mockResolvedValueOnce([mockExport])

    const result = await getExportStatus('export-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('export-1')
    expect(result!.status).toBe('completed')
    expect(result!.resultUrl).toBe('https://storage.example.com/export.json')
    expect(result!.completedAt).toEqual(new Date('2026-03-15'))
  })

  it('returns null when export not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await getExportStatus('nonexistent')

    expect(result).toBeNull()
  })

  it('returns pending status for in-progress export', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'export-2',
        requestType: 'data-export',
        entityType: 'provider',
        entityId: 'prov-456',
        status: 'processing',
        resultUrl: null,
        completedAt: null,
        createdAt: new Date('2026-03-14'),
      },
    ])

    const result = await getExportStatus('export-2')

    expect(result!.status).toBe('processing')
    expect(result!.resultUrl).toBeNull()
    expect(result!.completedAt).toBeNull()
  })

  it('returns correct data for a deletion request', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'del-1',
        requestType: 'data-deletion',
        entityType: 'customer',
        entityId: 'cust-123',
        status: 'completed',
        resultUrl: null,
        completedAt: new Date('2026-03-16'),
        createdAt: new Date('2026-03-15'),
      },
    ])

    const result = await getExportStatus('del-1')

    expect(result!.requestType).toBe('data-deletion')
    expect(result!.status).toBe('completed')
  })
})
