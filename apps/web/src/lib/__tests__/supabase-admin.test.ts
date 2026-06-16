/**
 * V-N3 compliance-honesty SLICE 2 — unit guards for deleteSupabaseAuthUser
 * (admin.ts), the LB-2 fail-closed + idempotency seam.
 *
 * Mocks supabase-js createClient + the env getters so the REAL admin.ts runs:
 *   - idempotent-404 → resolves (does not throw);
 *   - any other admin error → throws;
 *   - missing service-role key → throws a STATIC no-secret-leak message, and the
 *     client is never constructed (lazy fail-closed before any network call).
 *
 * NON-VACUITY: drop the `error.status === 404` branch in admin.ts → the 404 test
 * goes RED; drop the fail-closed throw → the missing-key test goes RED.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDeleteUser, mockCreateClient, envState } = vi.hoisted(() => {
  const mockDeleteUser = vi.fn()
  const mockCreateClient = vi.fn(() => ({
    auth: { admin: { deleteUser: mockDeleteUser } },
  }))
  const envState = { serviceRoleKey: 'service-role-key' as string | undefined }
  return { mockDeleteUser, mockCreateClient, envState }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/env', () => ({
  getSupabaseUrl: () => 'https://project.supabase.co',
  getSupabaseServiceRoleKey: () => envState.serviceRoleKey,
}))

import { deleteSupabaseAuthUser } from '@/lib/supabase/admin'

describe('deleteSupabaseAuthUser (admin.ts) — LB-2 fail-closed + idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    envState.serviceRoleKey = 'service-role-key'
  })

  it('calls auth.admin.deleteUser with the given user id (HARD delete — no soft-delete arg)', async () => {
    mockDeleteUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await deleteSupabaseAuthUser('user-abc')
    expect(mockDeleteUser).toHaveBeenCalledWith('user-abc')
    // HARD delete: exactly one arg, no shouldSoftDelete=true (which would retain
    // the row and re-introduce the false "auth records are deleted" claim).
    expect(mockDeleteUser.mock.calls[0]).toHaveLength(1)
  })

  it('constructs the admin client with autoRefreshToken/persistSession disabled', async () => {
    mockDeleteUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await deleteSupabaseAuthUser('user-abc')
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'service-role-key',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  })

  it('treats a 404 not-found as idempotent success (resolves, does not throw)', async () => {
    mockDeleteUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 404, message: 'User not found' },
    })
    await expect(deleteSupabaseAuthUser('gone-user')).resolves.toBeUndefined()
  })

  it('throws on any non-404 admin error', async () => {
    mockDeleteUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 500, message: 'Internal' },
    })
    await expect(deleteSupabaseAuthUser('user-x')).rejects.toBeTruthy()
  })

  it('FAIL-CLOSED: throws a static, no-secret-leak message when the service-role key is unset', async () => {
    envState.serviceRoleKey = undefined
    await expect(deleteSupabaseAuthUser('user-x')).rejects.toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is not set'
    )
    // Lazy fail-closed: the client must NOT have been constructed and no network
    // call attempted before the missing-key throw.
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })
})
