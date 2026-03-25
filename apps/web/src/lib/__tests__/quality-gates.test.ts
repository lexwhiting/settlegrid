import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    developerId: 'developer_id',
    description: 'description',
    pricingConfig: 'pricing_config',
    category: 'category',
  },
  developers: {
    id: 'id',
    name: 'name',
    slug: 'slug',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import { validateToolForActivation, buildQualityChecklist } from '@/lib/quality-gates'

describe('validateToolForActivation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockReset()
  })

  it('passes when all checks are met', async () => {
    // First call: tool data
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
      category: 'code',
    }])
    // Second call: developer profile
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(true)
    expect(result.failures).toHaveLength(0)
  })

  it('fails when tool is not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toContain('Tool not found.')
  })

  it('fails when description is too short', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'Too short',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
      category: 'code',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('Description must be at least 50 characters'),
    ]))
  })

  it('fails when description is null', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: null,
      pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
      category: 'code',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('Description must be at least 50 characters (currently 0)'),
    ]))
  })

  it('fails when pricing config has no cost', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 0 },
      category: 'code',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      'Pricing must be configured with a cost greater than $0',
    ]))
  })

  it('fails when pricing config is null', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: null,
      category: 'code',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      'Pricing must be configured with a cost greater than $0',
    ]))
  })

  it('fails when category is null', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
      category: null,
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      'A category must be selected',
    ]))
  })

  it('fails when category is empty string', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
      category: '',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      'A category must be selected',
    ]))
  })

  it('fails when developer has no name', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
      category: 'code',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: null,
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('developer profile must have a display name and slug'),
    ]))
  })

  it('fails when developer has no slug', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
      category: 'code',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: null,
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('developer profile must have a display name and slug'),
    ]))
  })

  it('collects all failures when multiple checks fail', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'Short',
      pricingConfig: null,
      category: null,
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: null,
      slug: null,
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toHaveLength(4)
  })

  it('passes with tiered pricing when methods have cost > 0', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: {
        model: 'tiered',
        methods: { analyze: { costCents: 10 }, summarize: { costCents: 5 } },
      },
      category: 'nlp',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(true)
    expect(result.failures).toHaveLength(0)
  })

  it('passes with outcome pricing when successCostCents > 0', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: {
        model: 'outcome',
        outcomeConfig: { successCostCents: 10 },
      },
      category: 'search',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(true)
    expect(result.failures).toHaveLength(0)
  })

  it('fails with per-token pricing when costPerToken is 0', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
      pricingConfig: { model: 'per-token', costPerToken: 0 },
      category: 'nlp',
    }])
    mockDb.limit.mockResolvedValueOnce([{
      name: 'Test Developer',
      slug: 'test-developer',
    }])

    const result = await validateToolForActivation('tool-1', 'dev-1')

    expect(result.passed).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      'Pricing must be configured with a cost greater than $0',
    ]))
  })
})

describe('buildQualityChecklist', () => {
  it('returns all checks passed for complete tool', () => {
    const checklist = buildQualityChecklist(
      {
        description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
        pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
        category: 'code',
      },
      { name: 'Test Developer', slug: 'test-developer' }
    )

    expect(checklist).toHaveLength(4)
    expect(checklist.every((c) => c.passed)).toBe(true)
  })

  it('returns all checks failed for empty tool', () => {
    const checklist = buildQualityChecklist(
      {
        description: null,
        pricingConfig: null,
        category: null,
      },
      { name: null, slug: null }
    )

    expect(checklist).toHaveLength(4)
    expect(checklist.every((c) => !c.passed)).toBe(true)
    // All should have a detail message
    expect(checklist.every((c) => c.detail !== null)).toBe(true)
  })

  it('returns mixed results for partially complete tool', () => {
    const checklist = buildQualityChecklist(
      {
        description: 'A sufficiently long description that exceeds fifty characters easily with room to spare.',
        pricingConfig: null,
        category: 'code',
      },
      { name: 'Dev', slug: null }
    )

    const passed = checklist.filter((c) => c.passed)
    const failed = checklist.filter((c) => !c.passed)

    expect(passed.length).toBe(2) // description + category
    expect(failed.length).toBe(2) // pricing + profile
  })
})
