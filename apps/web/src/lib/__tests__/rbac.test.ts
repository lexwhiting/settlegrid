import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup (hoisted) ---------------------------------------------------

const { mockGetMemberRole } = vi.hoisted(() => ({
  mockGetMemberRole: vi.fn(),
}))

vi.mock('@/lib/settlement/organizations', () => ({
  getMemberRole: mockGetMemberRole,
}))

// ---- Imports ----------------------------------------------------------------

import {
  hasPermission,
  checkPermission,
  requirePermission,
  PermissionDeniedError,
} from '@/lib/settlement/rbac'

import type { OrgPermission } from '@/lib/settlement/rbac'

// ---- Tests ------------------------------------------------------------------

describe('hasPermission', () => {
  describe('owner role', () => {
    it('has all permissions', () => {
      const permissions: OrgPermission[] = [
        'org.manage',
        'org.manage_members',
        'org.manage_tools',
        'org.manage_budgets',
        'org.view_analytics',
        'tools.create',
        'tools.use',
      ]

      for (const perm of permissions) {
        expect(hasPermission('owner', perm)).toBe(true)
      }
    })
  })

  describe('admin role', () => {
    it('has manage_members, manage_tools, manage_budgets, view_analytics, tools permissions', () => {
      expect(hasPermission('admin', 'org.manage_members')).toBe(true)
      expect(hasPermission('admin', 'org.manage_tools')).toBe(true)
      expect(hasPermission('admin', 'org.manage_budgets')).toBe(true)
      expect(hasPermission('admin', 'org.view_analytics')).toBe(true)
      expect(hasPermission('admin', 'tools.create')).toBe(true)
      expect(hasPermission('admin', 'tools.use')).toBe(true)
    })

    it('does NOT have org.manage', () => {
      expect(hasPermission('admin', 'org.manage')).toBe(false)
    })
  })

  describe('member role', () => {
    it('has tools.create, tools.use, and view_analytics', () => {
      expect(hasPermission('member', 'tools.create')).toBe(true)
      expect(hasPermission('member', 'tools.use')).toBe(true)
      expect(hasPermission('member', 'org.view_analytics')).toBe(true)
    })

    it('does NOT have manage permissions', () => {
      expect(hasPermission('member', 'org.manage')).toBe(false)
      expect(hasPermission('member', 'org.manage_members')).toBe(false)
      expect(hasPermission('member', 'org.manage_tools')).toBe(false)
      expect(hasPermission('member', 'org.manage_budgets')).toBe(false)
    })
  })

  describe('viewer role', () => {
    it('has view_analytics only', () => {
      expect(hasPermission('viewer', 'org.view_analytics')).toBe(true)
    })

    it('does NOT have any write permissions', () => {
      expect(hasPermission('viewer', 'org.manage')).toBe(false)
      expect(hasPermission('viewer', 'org.manage_members')).toBe(false)
      expect(hasPermission('viewer', 'org.manage_tools')).toBe(false)
      expect(hasPermission('viewer', 'org.manage_budgets')).toBe(false)
      expect(hasPermission('viewer', 'tools.create')).toBe(false)
      expect(hasPermission('viewer', 'tools.use')).toBe(false)
    })
  })
})

describe('checkPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when user has permission', async () => {
    mockGetMemberRole.mockResolvedValueOnce('admin')

    const result = await checkPermission('org-123', 'user-456', 'org.manage_members')

    expect(result).toBe(true)
    expect(mockGetMemberRole).toHaveBeenCalledWith('org-123', 'user-456')
  })

  it('returns false when user does not have permission', async () => {
    mockGetMemberRole.mockResolvedValueOnce('viewer')

    const result = await checkPermission('org-123', 'user-456', 'org.manage_members')

    expect(result).toBe(false)
  })

  it('returns false when user is not a member', async () => {
    mockGetMemberRole.mockResolvedValueOnce(null)

    const result = await checkPermission('org-123', 'user-unknown', 'org.view_analytics')

    expect(result).toBe(false)
  })
})

describe('requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not throw when user has permission', async () => {
    mockGetMemberRole.mockResolvedValueOnce('owner')

    await expect(
      requirePermission('org-123', 'user-owner', 'org.manage')
    ).resolves.not.toThrow()
  })

  it('throws PermissionDeniedError when user lacks permission', async () => {
    mockGetMemberRole.mockResolvedValueOnce('member')

    await expect(
      requirePermission('org-123', 'user-member', 'org.manage')
    ).rejects.toThrow(PermissionDeniedError)
  })

  it('throws PermissionDeniedError when user is not a member', async () => {
    mockGetMemberRole.mockResolvedValueOnce(null)

    await expect(
      requirePermission('org-123', 'user-unknown', 'org.view_analytics')
    ).rejects.toThrow(PermissionDeniedError)
  })

  it('error message includes user ID, permission, and org ID', async () => {
    mockGetMemberRole.mockResolvedValueOnce('viewer')

    try {
      await requirePermission('org-abc', 'user-xyz', 'tools.create')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionDeniedError)
      expect((err as PermissionDeniedError).message).toContain('user-xyz')
      expect((err as PermissionDeniedError).message).toContain('tools.create')
      expect((err as PermissionDeniedError).message).toContain('org-abc')
    }
  })
})
