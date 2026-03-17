import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- Mock setup (hoisted) ---------------------------------------------------

const {
  mockCreateOrganization,
  mockGetOrganization,
  mockUpdateOrgSettings,
  mockAddMember,
  mockRemoveMember,
  mockListMembers,
  mockGetCostAllocations,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockCreateOrganization: vi.fn(),
  mockGetOrganization: vi.fn(),
  mockUpdateOrgSettings: vi.fn(),
  mockAddMember: vi.fn(),
  mockRemoveMember: vi.fn(),
  mockListMembers: vi.fn(),
  mockGetCostAllocations: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('@/lib/settlement/organizations', () => ({
  createOrganization: mockCreateOrganization,
  getOrganization: mockGetOrganization,
  updateOrgSettings: mockUpdateOrgSettings,
  addMember: mockAddMember,
  removeMember: mockRemoveMember,
  listMembers: mockListMembers,
  getCostAllocations: mockGetCostAllocations,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: vi.fn().mockReturnValue('req-test-123'),
}))

// ---- Imports ----------------------------------------------------------------

import { POST as createOrg } from '@/app/api/orgs/route'
import { GET as getOrg, PATCH as patchOrg } from '@/app/api/orgs/[id]/route'
import { GET as getMembers, POST as addMemberRoute } from '@/app/api/orgs/[id]/members/route'
import { DELETE as deleteMember } from '@/app/api/orgs/[id]/members/[userId]/route'
import { GET as getAllocations } from '@/app/api/orgs/[id]/allocations/route'

// ---- Test helpers -----------------------------------------------------------

function makeRequest(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  const headers: Record<string, string> = { 'x-forwarded-for': '127.0.0.1' }
  if (body) {
    headers['content-type'] = 'application/json'
  }
  return new NextRequest(new URL(url, 'http://localhost:3005'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

const mockOrg = {
  id: 'org-123',
  name: 'Acme Corp',
  slug: 'acme-corp',
  plan: 'free',
  billingEmail: 'billing@acme.com',
  settings: {},
  monthlyBudgetCents: null,
  currentMonthSpendCents: 0,
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-01-01').toISOString(),
}

const mockMember = {
  id: 'mem-1',
  orgId: 'org-123',
  userId: 'user-456',
  role: 'member',
  createdAt: new Date('2026-01-01').toISOString(),
}

// ---- Tests ------------------------------------------------------------------

describe('POST /api/orgs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('creates an organization with valid input', async () => {
    mockCreateOrganization.mockResolvedValueOnce(mockOrg)
    mockAddMember.mockResolvedValueOnce(mockMember)

    const req = makeRequest('http://localhost:3005/api/orgs', 'POST', {
      name: 'Acme Corp',
      slug: 'acme-corp',
      billingEmail: 'billing@acme.com',
      ownerId: 'user-456',
    })

    const res = await createOrg(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.slug).toBe('acme-corp')
    expect(mockCreateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme Corp',
        slug: 'acme-corp',
      })
    )
    expect(mockAddMember).toHaveBeenCalledWith('org-123', 'user-456', 'owner')
  })

  it('returns 422 for invalid input', async () => {
    const req = makeRequest('http://localhost:3005/api/orgs', 'POST', {
      name: '',
      slug: '',
      billingEmail: 'not-an-email',
      ownerId: '',
    })

    const res = await createOrg(req)

    expect(res.status).toBe(422)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 })

    const req = makeRequest('http://localhost:3005/api/orgs', 'POST', {
      name: 'Rate Limited Corp',
      slug: 'rate-limited',
      billingEmail: 'billing@ratelimited.com',
      ownerId: 'user-123',
    })

    const res = await createOrg(req)

    expect(res.status).toBe(429)
  })
})

describe('GET /api/orgs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns an organization when found', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)

    const req = makeRequest('http://localhost:3005/api/orgs/org-123', 'GET')
    const res = await getOrg(req, { params: Promise.resolve({ id: 'org-123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('org-123')
  })

  it('returns 404 when not found', async () => {
    mockGetOrganization.mockResolvedValueOnce(null)

    const req = makeRequest('http://localhost:3005/api/orgs/nonexistent', 'GET')
    const res = await getOrg(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/orgs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('updates org settings', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)
    mockUpdateOrgSettings.mockResolvedValueOnce({
      ...mockOrg,
      settings: { ssoEnabled: true },
    })

    const req = makeRequest('http://localhost:3005/api/orgs/org-123', 'PATCH', {
      settings: { ssoEnabled: true },
    })
    const res = await patchOrg(req, { params: Promise.resolve({ id: 'org-123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.settings).toEqual({ ssoEnabled: true })
  })

  it('returns 404 when org not found', async () => {
    mockGetOrganization.mockResolvedValueOnce(null)

    const req = makeRequest('http://localhost:3005/api/orgs/nonexistent', 'PATCH', {
      settings: {},
    })
    const res = await patchOrg(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/orgs/[id]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns members for an org', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)
    mockListMembers.mockResolvedValueOnce([mockMember])

    const req = makeRequest('http://localhost:3005/api/orgs/org-123/members', 'GET')
    const res = await getMembers(req, { params: Promise.resolve({ id: 'org-123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].userId).toBe('user-456')
  })
})

describe('POST /api/orgs/[id]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('adds a member to an org', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)
    mockAddMember.mockResolvedValueOnce(mockMember)

    const req = makeRequest('http://localhost:3005/api/orgs/org-123/members', 'POST', {
      userId: 'user-456',
      role: 'member',
    })
    const res = await addMemberRoute(req, { params: Promise.resolve({ id: 'org-123' }) })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.userId).toBe('user-456')
  })

  it('returns 404 when org not found', async () => {
    mockGetOrganization.mockResolvedValueOnce(null)

    const req = makeRequest('http://localhost:3005/api/orgs/nonexistent/members', 'POST', {
      userId: 'user-456',
    })
    const res = await addMemberRoute(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/orgs/[id]/members/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('removes a member from an org', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)
    mockRemoveMember.mockResolvedValueOnce(true)

    const req = makeRequest('http://localhost:3005/api/orgs/org-123/members/user-456', 'DELETE')
    const res = await deleteMember(req, {
      params: Promise.resolve({ id: 'org-123', userId: 'user-456' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 404 when member not found', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)
    mockRemoveMember.mockResolvedValueOnce(false)

    const req = makeRequest('http://localhost:3005/api/orgs/org-123/members/nonexistent', 'DELETE')
    const res = await deleteMember(req, {
      params: Promise.resolve({ id: 'org-123', userId: 'nonexistent' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/orgs/[id]/allocations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns cost allocations for a period', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)
    mockGetCostAllocations.mockResolvedValueOnce([
      {
        id: 'ca-1',
        orgId: 'org-123',
        departmentTag: 'engineering',
        totalCents: 5000,
        operationCount: 250,
      },
    ])

    const req = makeRequest('http://localhost:3005/api/orgs/org-123/allocations?period=2026-03', 'GET')
    const res = await getAllocations(req, { params: Promise.resolve({ id: 'org-123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.orgId).toBe('org-123')
    expect(body.allocations).toHaveLength(1)
    expect(body.allocations[0].departmentTag).toBe('engineering')
  })

  it('defaults to current month when no period specified', async () => {
    mockGetOrganization.mockResolvedValueOnce(mockOrg)
    mockGetCostAllocations.mockResolvedValueOnce([])

    const req = makeRequest('http://localhost:3005/api/orgs/org-123/allocations', 'GET')
    const res = await getAllocations(req, { params: Promise.resolve({ id: 'org-123' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.allocations).toEqual([])
  })

  it('returns 404 when org not found', async () => {
    mockGetOrganization.mockResolvedValueOnce(null)

    const req = makeRequest('http://localhost:3005/api/orgs/nonexistent/allocations', 'GET')
    const res = await getAllocations(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
  })
})
