/**
 * Regression tests for docs/legal/privacy-notice-draft.md
 *
 * These tests guard the hostile-review fixes made on 2026-04-14 against
 * accidental reintroduction. The privacy notice is a legal document, not code
 * — but it makes factual claims about what personal data SettleGrid's own
 * schema stores, and those claims must stay aligned with the real schema.
 *
 * The hostile review found that an earlier draft of §3.1 listed four fields
 * that don't exist as columns on the `developers` table:
 *   - "business name"
 *   - "website URL"
 *   - "optional phone number"
 *   - "last four digits of the tax ID"
 * It also mis-characterized the `audit_logs.ip_address` / `user_agent`
 * columns as login-time capture; they are actually written against
 * administrative actions via writeAuditLog(), not against login events
 * (Supabase Auth holds login IP/UA in its own tables).
 *
 * §3.2, §5.1, §7(e), and §14.1 had related corrections that we want to keep
 * in force. Each describe block below locks in one specific finding.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PRIVACY_NOTICE_PATH = resolve(__dirname, '../../../../docs/legal/privacy-notice-draft.md')
const STRIPE_DPA_PATH = resolve(__dirname, '../../../../docs/legal/stripe-dpa-status.md')

const privacyNotice = readFileSync(PRIVACY_NOTICE_PATH, 'utf8')
const stripeDpa = readFileSync(STRIPE_DPA_PATH, 'utf8')

/**
 * Extract the body of a markdown section between two heading prefixes.
 * Uses indexOf so callers can pass a heading prefix rather than the exact
 * full heading line.
 */
function extractSection(text: string, startHeading: string, endHeading: string): string {
  const start = text.indexOf(startHeading)
  if (start === -1) {
    throw new Error(`Section start heading not found: ${JSON.stringify(startHeading)}`)
  }
  const afterStart = start + startHeading.length
  const end = text.indexOf(endHeading, afterStart)
  if (end === -1) {
    throw new Error(`Section end heading not found: ${JSON.stringify(endHeading)}`)
  }
  return text.slice(afterStart, end)
}

describe('privacy-notice-draft.md — structural integrity', () => {
  it('exists and is non-trivially long', () => {
    expect(privacyNotice.length).toBeGreaterThan(5000)
  })

  it('retains the DRAFT banner (guards against accidental promotion to published)', () => {
    // The DRAFT banner is the single clearest signal to any reader that this
    // document has not been lawyer-reviewed. Removing it without a counsel
    // sign-off would create real liability.
    expect(privacyNotice).toMatch(/⚠️\s+\*\*DRAFT/)
    expect(privacyNotice).toMatch(/pending lawyer review/i)
  })

  it('has all 14 numbered top-level sections', () => {
    const sections = [
      '## 1. Who we are',
      '## 2. Scope of this notice',
      '## 3. Data we collect',
      '## 4. How we use your data',
      '## 5. Subprocessors and data sharing',
      '## 6. Lawful basis for processing',
      '## 7. Notice to India-resident Developers',
      '## 8. Cookies and analytics disclosures',
      '## 9. Data subject rights',
      '## 10. Data retention',
      '## 11. Security',
      '## 12. Children',
      '## 13. Changes to this notice',
      '## 14. Jurisdiction-specific disclosures',
    ]
    for (const section of sections) {
      expect(privacyNotice, `missing top-level section: ${section}`).toContain(section)
    }
  })

  it('retains the engineering Drafting Notes section for the lawyer reviewer', () => {
    expect(privacyNotice).toContain('## Drafting Notes')
    // The drafting notes should warn the reviewer they are not published.
    expect(privacyNotice).toMatch(/NOT part of the executed Privacy Notice/i)
  })

  it('declares Pattern A+ architecture context (Polar abandoned)', () => {
    // This prevents a future editor from silently re-introducing the Polar
    // subprocessor entry after the 2026-04-14 pivot.
    expect(privacyNotice).toMatch(/Pattern A\+/)
    expect(privacyNotice).toMatch(/Polar was abandoned|polar-onboarding-status/i)
  })
})

describe('privacy-notice-draft.md — §3.1 hostile-review regression guards', () => {
  // Grab §3.1 only so positive phrases in §3.2 (the exclusions section)
  // don't accidentally satisfy "§3.1 doesn't mention X" assertions.
  const section31 = extractSection(
    privacyNotice,
    '### 3.1 From Developers',
    '### 3.2 What SettleGrid does NOT collect',
  )

  it('§3.1 is non-empty and derived from the actual schema', () => {
    expect(section31.length).toBeGreaterThan(1000)
    // The audit-driven rewrite explicitly states the list is schema-derived.
    expect(section31).toMatch(/auditing SettleGrid's `developers` table/i)
  })

  it('§3.1 does NOT claim SettleGrid holds the last four digits of the tax ID', () => {
    // This was the most load-bearing hostile finding: the first draft
    // claimed SettleGrid stored `tax_id_last_four`, but no such column
    // exists anywhere in the schema. All tax IDs are held exclusively by
    // Stripe during Connect onboarding.
    expect(section31).not.toMatch(/last four digits of the tax ID/i)
    expect(section31).not.toMatch(/tax ID.*last[- ]?four/i)
    expect(section31).not.toMatch(/retained for reconciliation/i)
  })

  it('§3.1 does NOT claim SettleGrid holds a Developer phone number', () => {
    // There is no `phone` or `phone_number` column on the developers table.
    // Any phone numbers the Developer provides are held by Stripe.
    expect(section31).not.toMatch(/\bphone number\b/i)
    expect(section31).not.toMatch(/optional phone number/i)
  })

  it('§3.1 does NOT claim SettleGrid holds a business name', () => {
    // There is no `business_name` column on the developers table. Legal
    // entity names are held by Stripe during Connect onboarding.
    expect(section31).not.toMatch(/\bbusiness name\b/i)
  })

  it('§3.1 does NOT claim SettleGrid holds a Developer website URL', () => {
    // There is no `website_url` column on the developers table. Tools may
    // have a source-repo URL but that's a per-tool field, not a Developer
    // profile field.
    expect(section31).not.toMatch(/\bwebsite URL\b/i)
  })

  it('§3.1 does NOT describe IP or user-agent capture as happening at login', () => {
    // SettleGrid's `audit_logs.ip_address` / `user_agent` columns are
    // written by writeAuditLog() against administrative actions (key
    // revocation, payout trigger, settings change), not against login
    // events. Login IP/UA is held by Supabase Auth in its own tables.
    expect(section31).not.toMatch(/IP address at login/i)
    expect(section31).not.toMatch(/user agent at login/i)
  })

  it('§3.1 positively covers the real schema categories (sanity)', () => {
    // Guards against a future edit that drops the rewritten content and
    // accidentally reverts to a less-accurate list.
    expect(section31).toContain('Stripe Customer ID')
    expect(section31).toContain('Stripe Connected Account')
    expect(section31).toMatch(/API[- ]key/i)
    expect(section31).toMatch(/notification.*webhook/i)
    expect(section31).toMatch(/founding-?member/i)
    expect(section31).toMatch(/referral/i)
    expect(section31).toMatch(/retention/i)
  })

  it('§3.1 correctly scopes IP/UA capture to administrative audit events', () => {
    // Positive counterpart to the "not at login" assertion above.
    expect(section31).toMatch(/administrative action/i)
    expect(section31).toMatch(/IP address and user agent/i)
  })
})

describe('privacy-notice-draft.md — §3.2 exclusions (hostile-review strengthening)', () => {
  const section32 = extractSection(
    privacyNotice,
    '### 3.2 What SettleGrid does NOT collect',
    '### 3.3 From Customers',
  )

  it('§3.2 explicitly states tax identifiers are never held, even truncated', () => {
    // The first draft's "Full tax ID ... in plaintext" wording implied a
    // possible hashed / truncated version. The hostile-review rewrite
    // slams that door shut.
    expect(section32).toMatch(/tax identifiers of any kind/i)
    expect(section32).toMatch(/truncated form/i)
  })

  it('§3.2 covers banking-detail exclusions (US + international)', () => {
    expect(section32).toMatch(/IBAN/)
    expect(section32).toMatch(/routing numbers/i)
    expect(section32).toMatch(/SWIFT/)
  })

  it('§3.2 explicitly excludes phone / business name / website URL as non-fields', () => {
    // These are the mirror-image of the §3.1 regression guards: if the
    // claim "SettleGrid does not collect X" is ever dropped, that's as
    // much a regression as re-adding "SettleGrid does collect X" to §3.1.
    expect(section32).toMatch(/\bphone number\b/i)
    expect(section32).toMatch(/\bbusiness name\b/i)
    expect(section32).toMatch(/\bwebsite URL\b/i)
  })

  it('§3.2 excludes archival of invocation payload bodies', () => {
    // Protects the "we don't store your prompts" claim in §4.
    expect(section32).toMatch(/request bodies or responses/i)
  })
})

describe('privacy-notice-draft.md — §5.1 Stripe DPA status language', () => {
  const section51 = extractSection(
    privacyNotice,
    '### 5.1 Stripe Payments Company',
    '### 5.2 Supabase',
  )

  it('describes the DPA as in-effect via SSA auto-incorporation', () => {
    expect(section51).toMatch(/in effect for SettleGrid/i)
    expect(section51).toMatch(/automatic incorporation/i)
    expect(section51).toMatch(/Stripe Services Agreement/i)
  })

  it('does NOT contain the stale "executed (or will execute)" language', () => {
    // This was the phrasing in the first draft, before we confirmed that
    // Stripe's Dashboard does not expose a click-to-execute flow for this
    // account type.
    expect(section51).not.toMatch(/executed \(or will execute\)/i)
  })

  it('references the Stripe DPA status tracker file', () => {
    expect(section51).toContain('docs/legal/stripe-dpa-status.md')
  })
})

describe('privacy-notice-draft.md — §7(e) DPDP cross-border transfer', () => {
  const section7 = extractSection(
    privacyNotice,
    '## 7. Notice to India-resident Developers',
    '## 8. Cookies',
  )

  it('does NOT claim servers are "primarily located" in specific regions', () => {
    // The first draft's "primarily located in the United States and
    // European Union (Supabase regions)" assertion was speculative — no
    // config file was checked. The rewrite defers region disclosure.
    expect(section7).not.toMatch(/primarily located in the United States/i)
    expect(section7).not.toMatch(/\(Supabase regions\)/i)
  })

  it('defers specific-region disclosure to an amendment before India onboarding', () => {
    expect(section7).toMatch(/amendment to this Notice before any India-resident Developer is onboarded/i)
  })

  it('preserves the DPDP grievance-redressal contact', () => {
    // The hostile-review rewrite touched §7(e) only; §7 as a whole should
    // still name the grievance-redressal contact.
    expect(section7).toContain('privacy@settlegrid.ai')
    expect(section7).toMatch(/Data Protection Board of India/i)
  })
})

describe('privacy-notice-draft.md — §14.1 CCPA sensitive-PII carveout', () => {
  const section141 = extractSection(
    privacyNotice,
    '### 14.1 California residents',
    '### 14.2 Virginia',
  )

  it('does NOT carve out a "tax ID last-four retained for reconciliation" exception', () => {
    // Matches the §3.1 fictional-field regression: §14.1 also has to stay
    // consistent with the actual schema.
    expect(section141).not.toMatch(/tax ID last-?four/i)
    expect(section141).not.toMatch(/retained for reconciliation/i)
  })

  it('states SettleGrid has nothing to limit under the sensitive-PII subsection', () => {
    expect(section141).toMatch(/nothing to limit under this subsection/i)
  })

  it('preserves the CCPA right list and the no-sale declaration', () => {
    expect(section141).toMatch(/Right to know/i)
    expect(section141).toMatch(/Right to delete/i)
    expect(section141).toMatch(/does not sell personal information/i)
  })
})

describe('privacy-notice-draft.md — drafting notes lock-in', () => {
  // The drafting notes block is where the hostile-review findings are
  // explained to the lawyer reviewer. If somebody drops that block, the
  // lawyer won't know why §3.1 looks the way it does and might re-introduce
  // the fictional fields. These assertions prevent silent drop.
  //
  // The drafting notes section is the last section in the file, so we read
  // from its heading to end-of-file rather than using extractSection (which
  // requires a terminating heading).
  const draftingNotesStart = privacyNotice.indexOf('## Drafting Notes')
  const notesFromStart = draftingNotesStart === -1
    ? ''
    : privacyNotice.slice(draftingNotesStart)

  it('drafting notes block is present at end-of-file', () => {
    expect(draftingNotesStart).toBeGreaterThan(0)
    expect(notesFromStart.length).toBeGreaterThan(1000)
  })

  it('has a drafting note covering the §3.1 audit-driven correction', () => {
    expect(notesFromStart).toMatch(/audit-driven correction/i)
    expect(notesFromStart).toMatch(/business name/i)
    expect(notesFromStart).toMatch(/optional phone number/i)
    expect(notesFromStart).toMatch(/last four digits of the tax ID/i)
  })

  it('has a drafting note covering the §7(e) deferred-region approach', () => {
    expect(notesFromStart).toMatch(/DPDP cross-border transfer language/i)
    expect(notesFromStart).toMatch(/speculative/i)
  })

  it('has a drafting note explaining the DPA status language correction', () => {
    expect(notesFromStart).toMatch(/DPA status language/i)
    expect(notesFromStart).toMatch(/auto-incorporated-via-SSA/i)
  })
})

describe('stripe-dpa-status.md — status tracker', () => {
  it('exists and is non-trivially long', () => {
    expect(stripeDpa.length).toBeGreaterThan(1000)
  })

  it('reports DPA status as IN EFFECT', () => {
    expect(stripeDpa).toMatch(/IN EFFECT/)
  })

  it('documents the SSA auto-incorporation mechanism', () => {
    expect(stripeDpa).toMatch(/Stripe Services Agreement/i)
    expect(stripeDpa).toMatch(/auto-incorporated|automatically incorporated|incorporated.*SSA/i)
  })

  it('retains the optional countersigned PDF request draft email', () => {
    // This is the output the founder uses if they want a countersigned PDF.
    // Dropping it would lose the turn-key path.
    expect(stripeDpa).toMatch(/compliance@stripe\.com/i)
  })

  it('notes that a countersigned PDF is optional, not required', () => {
    expect(stripeDpa).toMatch(/optional/i)
  })
})
