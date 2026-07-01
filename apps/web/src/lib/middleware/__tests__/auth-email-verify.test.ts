/**
 * G3-1 mailbox-proof unit coverage — the security-critical predicates behind
 * `requireConsumer(request, { requireEmailVerified: true })`.
 *
 * These functions ARE the mailbox-control gate for the $500 academic grant. The
 * academic route tests mock `requireConsumer` wholesale, so without this file
 * the M4 identity-match defense and the auto-confirm tripwire would be untested.
 *
 * NOTE (live-Supabase dependency, tracked as a §S pre-launch smoke): the exact
 * runtime shape of `identity_data.email_verified` for a confirmed email/password
 * user, and whether OAuth instant-confirm makes `email_confirmed_at === created_at`,
 * are GoTrue behaviors that cannot be executed here. These tests pin the CODE's
 * behavior for given shapes; the live smoke validates that real confirmed users
 * (password + Google-Workspace .edu) actually satisfy them.
 */
import { describe, it, expect, vi } from 'vitest'

// auth.ts instantiates a DB client at import; neutralize it (the predicates
// under test are pure and touch neither db nor supabase).
vi.mock('@/lib/db', () => ({ db: {} }))

import { currentEmailIsVerified, emailAutoConfirmSuspected } from '@/lib/middleware/auth'

describe('currentEmailIsVerified — the mailbox-control gate (fail-closed)', () => {
  it('accepts a confirmed email backed by a matching verified identity', () => {
    expect(
      currentEmailIsVerified({
        email: 'alice@harvard.edu',
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
        identities: [{ identity_data: { email: 'alice@harvard.edu', email_verified: true } }],
      })
    ).toBe(true)
  })

  it('is case-insensitive on the identity/email match', () => {
    expect(
      currentEmailIsVerified({
        email: 'Alice@Harvard.EDU',
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
        identities: [{ identity_data: { email: 'alice@harvard.edu', email_verified: true } }],
      })
    ).toBe(true)
  })

  it('REJECTS the M4 email-swap: email_confirmed_at truthy but no identity matches the CURRENT email', () => {
    // Attacker confirmed gmail, then swapped the account email to a victim .edu
    // (Secure email change OFF). email_confirmed_at reflects the PRIOR email; the
    // current email has no verified identity → must fail closed.
    expect(
      currentEmailIsVerified({
        email: 'victim@harvard.edu',
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
        identities: [{ identity_data: { email: 'attacker@gmail.com', email_verified: true } }],
      })
    ).toBe(false)
  })

  it('rejects when email_confirmed_at is absent', () => {
    expect(
      currentEmailIsVerified({
        email: 'alice@harvard.edu',
        email_confirmed_at: null,
        created_at: '2026-05-01T00:00:00Z',
        identities: [{ identity_data: { email: 'alice@harvard.edu', email_verified: true } }],
      })
    ).toBe(false)
  })

  it('rejects when the matching identity is not email_verified', () => {
    expect(
      currentEmailIsVerified({
        email: 'alice@harvard.edu',
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
        identities: [{ identity_data: { email: 'alice@harvard.edu', email_verified: false } }],
      })
    ).toBe(false)
  })

  it('rejects when email_verified is missing (strict === true, fail-closed)', () => {
    expect(
      currentEmailIsVerified({
        email: 'alice@harvard.edu',
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
        identities: [{ identity_data: { email: 'alice@harvard.edu' } }],
      })
    ).toBe(false)
  })

  it('rejects when there is no email at all', () => {
    expect(
      currentEmailIsVerified({
        email: null,
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
        identities: [{ identity_data: { email: 'alice@harvard.edu', email_verified: true } }],
      })
    ).toBe(false)
  })

  it('rejects when there are no identities', () => {
    expect(
      currentEmailIsVerified({
        email: 'alice@harvard.edu',
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
        identities: [],
      })
    ).toBe(false)
  })
})

describe('emailAutoConfirmSuspected — auto-confirm tripwire signature', () => {
  it('flags byte-identical email_confirmed_at === created_at (auto-confirm signature)', () => {
    const t = '2026-05-01T00:00:00Z'
    expect(emailAutoConfirmSuspected({ email_confirmed_at: t, created_at: t })).toBe(true)
  })

  it('does NOT flag when the confirm timestamp is distinct from creation (confirm-required)', () => {
    expect(
      emailAutoConfirmSuspected({
        email_confirmed_at: '2026-06-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
      })
    ).toBe(false)
  })

  it('does NOT flag when email_confirmed_at is absent', () => {
    expect(emailAutoConfirmSuspected({ email_confirmed_at: null, created_at: '2026-05-01T00:00:00Z' })).toBe(false)
  })

  it('does NOT flag when created_at is absent', () => {
    expect(emailAutoConfirmSuspected({ email_confirmed_at: '2026-05-01T00:00:00Z', created_at: null })).toBe(false)
  })
})
