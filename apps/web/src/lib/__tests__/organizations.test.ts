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
    delete: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  organizations: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    plan: 'plan',
    billingEmail: 'billing_email',
    settings: 'settings',
    monthlyBudgetCents: 'monthly_budget_cents',
    currentMonthSpendCents: 'current_month_spend_cents',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  organizationMembers: {
    id: 'id',
    orgId: 'org_id',
    userId: 'user_id',
    role: 'role',
    createdAt: 'created_at',
  },
  costAllocations: {
    id: 'id',
    orgId: 'org_id',
    departmentTag: 'department_tag',
    serviceId: 'service_id',
    periodStart: 'period_start',
    periodEnd: 'period_end',
    totalCents: 'total_cents',
    operationCount: 'operation_count',
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
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  lte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ lte: [a, b] })),
  // getCostAllocations uses sql template literal for SUM aggregation
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

// ---- Imports (after mocks) --------------------------------------------------

import {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  updateOrgSettings,
  checkOrgBudget,
  addMember,
  removeMember,
  listMembers,
  getMemberRole,
  getCostAllocations,
  isValidSlug,
} from '@/lib/settlement/organizations'

// ---- Test data --------------------------------------------------------------

const mockOrg = {
  id: 'org-123',
  name: 'Acme Corp',
  slug: 'acme-corp',
  plan: 'free',
  billingEmail: 'billing@acme.com',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  settings: {},
  monthlyBudgetCents: null,
  currentMonthSpendCents: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const mockMember = {
  id: 'mem-1',
  orgId: 'org-123',
  userId: 'user-456',
  role: 'member',
  createdAt: new Date('2026-01-01'),
}

// ---- Tests ------------------------------------------------------------------

describe('isValidSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidSlug('acme-corp')).toBe(true)
    expect(isValidSlug('ab')).toBe(true)
    expect(isValidSlug('my-org-123')).toBe(true)
    expect(isValidSlug('a1')).toBe(true)
  })

  it('rejects too short slugs', () => {
    expect(isValidSlug('a')).toBe(false)
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects slugs starting or ending with hyphen', () => {
    expect(isValidSlug('-acme')).toBe(false)
    expect(isValidSlug('acme-')).toBe(false)
    expect(isValidSlug('-acme-')).toBe(false)
  })

  it('rejects slugs with invalid characters', () => {
    expect(isValidSlug('Acme Corp')).toBe(false)
    expect(isValidSlug('acme_corp')).toBe(false)
    expect(isValidSlug('acme.corp')).toBe(false)
  })

  it('rejects slugs that are too long', () => {
    const longSlug = 'a' + 'b'.repeat(63)
    expect(isValidSlug(longSlug)).toBe(false)
  })
})

describe('createOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an organization with valid input', async () => {
    mockDb.returning.mockResolvedValueOnce([mockOrg])

    const result = await createOrganization({
      name: 'Acme Corp',
      slug: 'acme-corp',
      billingEmail: 'billing@acme.com',
    })

    expect(result).toEqual(mockOrg)
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme Corp',
        slug: 'acme-corp',
        billingEmail: 'billing@acme.com',
        plan: 'free',
      })
    )
  })

  it('creates an organization with a specific plan', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...mockOrg, plan: 'enterprise' }])

    const result = await createOrganization({
      name: 'Enterprise Corp',
      slug: 'enterprise-corp',
      billingEmail: 'billing@enterprise.com',
      plan: 'enterprise',
    })

    expect(result.plan).toBe('enterprise')
  })

  it('sanitizes the slug during creation', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...mockOrg, slug: 'my-org' }])

    await createOrganization({
      name: 'My Org',
      slug: 'My--Org',
      billingEmail: 'billing@myorg.com',
    })

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'my-org',
      })
    )
  })

  it('throws on invalid slug after sanitization', async () => {
    await expect(
      createOrganization({
        name: 'Bad',
        slug: '-',
        billingEmail: 'billing@bad.com',
      })
    ).rejects.toThrow('Invalid slug')
  })

  it('throws on empty slug', async () => {
    await expect(
      createOrganization({
        name: 'Empty',
        slug: '',
        billingEmail: 'billing@empty.com',
      })
    ).rejects.toThrow('Invalid slug')
  })
})

describe('getOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an organization when found', async () => {
    mockDb.limit.mockResolvedValueOnce([mockOrg])

    const result = await getOrganization('org-123')

    expect(result).toEqual(mockOrg)
  })

  it('returns null when not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await getOrganization('nonexistent')

    expect(result).toBeNull()
  })
})

describe('getOrganizationBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an organization by slug', async () => {
    mockDb.limit.mockResolvedValueOnce([mockOrg])

    const result = await getOrganizationBySlug('acme-corp')

    expect(result).toEqual(mockOrg)
  })

  it('returns null when slug not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await getOrganizationBySlug('nonexistent')

    expect(result).toBeNull()
  })
})

describe('updateOrgSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates settings and returns updated org', async () => {
    const updated = { ...mockOrg, settings: { ssoEnabled: true } }
    mockDb.returning.mockResolvedValueOnce([updated])

    const result = await updateOrgSettings('org-123', { ssoEnabled: true })

    expect(result).toEqual(updated)
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('returns null when org not found', async () => {
    mockDb.returning.mockResolvedValueOnce([])

    const result = await updateOrgSettings('nonexistent', {})

    expect(result).toBeNull()
  })
})

describe('checkOrgBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows spending when no budget limit is set (unlimited)', async () => {
    mockDb.limit.mockResolvedValueOnce([{ ...mockOrg, monthlyBudgetCents: null }])

    const result = await checkOrgBudget('org-123', 1000)

    expect(result.allowed).toBe(true)
    expect(result.remainingCents).toBe(Infinity)
  })

  it('allows spending within budget', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { ...mockOrg, monthlyBudgetCents: 10000, currentMonthSpendCents: 5000 },
    ])

    const result = await checkOrgBudget('org-123', 3000)

    expect(result.allowed).toBe(true)
    expect(result.remainingCents).toBe(5000)
  })

  it('denies spending over budget', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { ...mockOrg, monthlyBudgetCents: 10000, currentMonthSpendCents: 8000 },
    ])

    const result = await checkOrgBudget('org-123', 5000)

    expect(result.allowed).toBe(false)
    expect(result.remainingCents).toBe(2000)
  })

  it('returns not allowed for nonexistent org', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await checkOrgBudget('nonexistent', 100)

    expect(result.allowed).toBe(false)
    expect(result.remainingCents).toBe(0)
  })

  it('denies when budget is exactly zero remaining', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { ...mockOrg, monthlyBudgetCents: 10000, currentMonthSpendCents: 10000 },
    ])

    const result = await checkOrgBudget('org-123', 1)

    expect(result.allowed).toBe(false)
    expect(result.remainingCents).toBe(0)
  })
})

describe('addMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds a member with default role', async () => {
    mockDb.returning.mockResolvedValueOnce([mockMember])

    const result = await addMember('org-123', 'user-456')

    expect(result).toEqual(mockMember)
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-123',
        userId: 'user-456',
        role: 'member',
      })
    )
  })

  it('adds a member with admin role', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...mockMember, role: 'admin' }])

    const result = await addMember('org-123', 'user-789', 'admin')

    expect(result.role).toBe('admin')
  })

  it('adds a member with owner role', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...mockMember, role: 'owner' }])

    const result = await addMember('org-123', 'user-owner', 'owner')

    expect(result.role).toBe('owner')
  })

  it('adds a member with viewer role', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...mockMember, role: 'viewer' }])

    const result = await addMember('org-123', 'user-viewer', 'viewer')

    expect(result.role).toBe('viewer')
  })
})

describe('removeMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes a member and returns true', async () => {
    mockDb.returning.mockResolvedValueOnce([mockMember])

    const result = await removeMember('org-123', 'user-456')

    expect(result).toBe(true)
  })

  it('returns false when member not found', async () => {
    mockDb.returning.mockResolvedValueOnce([])

    const result = await removeMember('org-123', 'nonexistent')

    expect(result).toBe(false)
  })
})

describe('listMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all members for an org', async () => {
    const members = [
      mockMember,
      { ...mockMember, id: 'mem-2', userId: 'user-789', role: 'admin' },
    ]
    mockDb.limit.mockResolvedValueOnce(members)

    const result = await listMembers('org-123')

    expect(result).toHaveLength(2)
    expect(result[0].userId).toBe('user-456')
    expect(result[1].userId).toBe('user-789')
  })

  it('returns empty array when no members', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await listMembers('org-empty')

    expect(result).toEqual([])
  })
})

describe('getMemberRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the role when member exists', async () => {
    mockDb.limit.mockResolvedValueOnce([{ role: 'admin' }])

    const result = await getMemberRole('org-123', 'user-456')

    expect(result).toBe('admin')
  })

  it('returns null when member does not exist', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await getMemberRole('org-123', 'nonexistent')

    expect(result).toBeNull()
  })
})

describe('getCostAllocations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cost allocations for a period', async () => {
    const allocations = [
      {
        id: 'ca-1',
        orgId: 'org-123',
        departmentTag: 'engineering',
        serviceId: 'tool-1',
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-04-01'),
        totalCents: 5000,
        operationCount: 250,
        createdAt: new Date('2026-03-15'),
      },
    ]
    mockDb.limit.mockResolvedValueOnce(allocations)

    const result = await getCostAllocations(
      'org-123',
      new Date('2026-03-01'),
      new Date('2026-04-01')
    )

    expect(result).toHaveLength(1)
    expect(result[0].departmentTag).toBe('engineering')
    expect(result[0].totalCents).toBe(5000)
  })

  it('returns empty array when no allocations exist', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const result = await getCostAllocations(
      'org-123',
      new Date('2026-01-01'),
      new Date('2026-02-01')
    )

    expect(result).toEqual([])
  })
})
