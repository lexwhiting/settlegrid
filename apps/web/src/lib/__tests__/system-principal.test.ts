/**
 * Unit teeth for the shared system-principal identity guard (③ deep-audit A-1 / DC-27).
 * `isSystemPrincipal` is the discriminator the processDataDeletion chokepoint, both
 * erasure doors, and the auth/callback relink guard all key on. It MUST match the
 * system catalog principal by the stable slug AND by both the new + legacy emails
 * (the legacy email is on the third-party settlegrid.com domain, so the existing prod
 * row still carries it until ops migrates it), and MUST NOT match any real subject.
 */
import { describe, it, expect } from 'vitest'
import {
  isSystemPrincipal,
  SYSTEM_DEVELOPER_SLUG,
  SYSTEM_DEVELOPER_EMAIL,
} from '@/lib/system-principal'

describe('isSystemPrincipal — system catalog principal discriminator', () => {
  it('matches by the stable slug regardless of email (the load-bearing anchor)', () => {
    expect(isSystemPrincipal({ slug: SYSTEM_DEVELOPER_SLUG, email: 'anything@x.com' })).toBe(true)
    expect(isSystemPrincipal({ slug: 'settlegrid-system', email: null })).toBe(true)
  })

  it('matches by the new company-domain email and the LEGACY third-party email', () => {
    expect(isSystemPrincipal({ email: SYSTEM_DEVELOPER_EMAIL, slug: null })).toBe(true)
    expect(isSystemPrincipal({ email: 'system@settlegrid.ai', slug: null })).toBe(true)
    // Legacy prod value on the third-party domain — still recognized until migrated.
    expect(isSystemPrincipal({ email: 'system@settlegrid.com', slug: null })).toBe(true)
    // Case-insensitive.
    expect(isSystemPrincipal({ email: 'System@SettleGrid.Com', slug: null })).toBe(true)
  })

  it('does NOT match a real developer subject (zero false-positive)', () => {
    expect(isSystemPrincipal({ email: 'dev@example.com', slug: 'my-cool-tool-dev' })).toBe(false)
    expect(isSystemPrincipal({ email: 'someone@settlegrid.ai', slug: 'someone' })).toBe(false) // not the system local-part
    expect(isSystemPrincipal({ email: null, slug: null })).toBe(false)
    expect(isSystemPrincipal({})).toBe(false)
  })

  it('SYSTEM_DEVELOPER_EMAIL is on the company domain, NOT the third-party settlegrid.com', () => {
    // Regression guard: the future-creation email must never be the third-party domain.
    expect(SYSTEM_DEVELOPER_EMAIL.endsWith('@settlegrid.ai')).toBe(true)
    expect(SYSTEM_DEVELOPER_EMAIL).not.toContain('settlegrid.com')
  })
})
