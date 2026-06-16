/**
 * V-N3 (compliance-honesty slice) — regression guards for the GDPR
 * Article-17 data-deletion claim.
 *
 * Closes a LIVE DC-16 false-compliance claim. Before this fix, three surfaces
 * told a developer who exercised GDPR erasure that financial-record PII was
 * "scrubbed across all tables" — but `processDataDeletion` never touches
 * `ledger_entries`, which persists the anonymous on-chain PAYER's raw EVM
 * address in `operation_id` ({rail}:{network}:{payer}:{nonce}) and
 * `metadata.payer`, UN-scrubbed. See
 * docs/tech-debt/v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md (§2,§3).
 *
 * Strategy (MANDATED): SOURCE-TEXT readFileSync + region-scoped regex. We do
 * NOT run processDataDeletion — it returns only { status }; the resultUrl JSON
 * is persisted into the complianceExports row, not returned; and a docstring is
 * a comment, assertable only as source text. Each region is sliced so an
 * assertion about one surface cannot be vacuously satisfied by another (e.g.
 * the resultUrl array also names operation_id/metadata.payer — the docstring
 * region must be sliced to exclude it so the docstring's own disclosure is what
 * is being pinned).
 *
 * The three surfaces (handoff §1 table A/B, C, D):
 *   - compliance.ts processDataDeletion DOCSTRING  (A + B)
 *   - compliance.ts resultUrl JSON                 (C, persisted record)
 *   - docs/page.tsx "How does GDPR data deletion work?" FAQ  (D, public)
 *
 * NOTE on surface C: the deletion resultUrl is PERSISTED into the
 * complianceExports row but is NOT served to the developer by the download route
 * today — that route only decodes the EXPORT path's
 * `data:application/json;base64,` form; a raw-JSON deletion resultUrl hits the
 * redirect fallback (which throws on an invalid URL), and the deletion also
 * severs the developer's own auth. What this chunk guarantees is that the
 * persisted record is HONEST; its reachability is a separate, pre-existing
 * concern routed to V-N3-erasure. (Earlier handoff wording calling C
 * "developer-downloadable, confirmed" was aspirational — see the ③ deep audit.)
 *
 * NON-VACUITY: reverting ANY one of the three edits turns this file RED — each
 * assertion block is anchored to its own region (see the per-block comments).
 *
 * ⚠ This file deliberately does NOT use a blanket /scrub/i ban: compliance.ts
 * legitimately contains "Scrub IP/UA from audit logs" (step 5, a real scrub
 * that DOES happen) and the honest disclosures say the payer address is "NOT
 * scrubbed" / "UN-scrubbed". Each absence assertion targets the specific FALSE
 * phrasing, scoped to its region — never the bare token "scrub".
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const COMPLIANCE_PATH = resolve(__dirname, '../settlement/compliance.ts')
const DOCS_PATH = resolve(__dirname, '../../app/docs/page.tsx')
const EMAIL_PATH = resolve(__dirname, '../email.ts')

const complianceSrc = readFileSync(COMPLIANCE_PATH, 'utf8')
const docsSrc = readFileSync(DOCS_PATH, 'utf8')
const emailSrc = readFileSync(EMAIL_PATH, 'utf8')

/**
 * Slice the text between two markers (indexOf-based, like the privacy-notice
 * regression test's extractSection). Throws — rather than returning '' — if a
 * marker is missing, so a renamed anchor surfaces as a loud failure instead of
 * a silently-vacuous empty region.
 */
function region(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker)
  if (start === -1) {
    throw new Error(`region start marker not found: ${JSON.stringify(startMarker)}`)
  }
  const afterStart = start + startMarker.length
  const end = text.indexOf(endMarker, afterStart)
  if (end === -1) {
    throw new Error(`region end marker not found: ${JSON.stringify(endMarker)}`)
  }
  return text.slice(afterStart, end)
}

// ── Region A/B: the processDataDeletion docstring (ends before the function) ──
const docstring = region(
  complianceSrc,
  '* Process a pending data deletion request.',
  'export async function processDataDeletion',
)

// ── Region C: the resultUrl JSON written into the complianceExports row ──────
const resultUrl = region(
  complianceSrc,
  'resultUrl: JSON.stringify({',
  'completedAt: new Date(),',
)

// ── Region D: the public "How does GDPR data deletion work?" FAQ answer ──────
const gdprFaq = region(
  docsSrc,
  'How does GDPR data deletion work?',
  'Is there an OpenAPI specification?',
)

// ── SLICE 2 regions ──────────────────────────────────────────────────────────

// The "What data is retained after account deletion?" FAQ — its "Supabase auth
// records are deleted" sub-claim is TRUE only because the behavioral fix
// hard-deletes the auth.users row. Sliced to its own answer so the pin can't be
// vacuously satisfied by the GDPR-deletion FAQ above.
const retainedAfterFaq = region(
  docsSrc,
  'What data is retained after account deletion?',
  'Can I request my data be removed from backups?',
)

// The "Can I request my data be removed from backups?" FAQ — its backup-erasure
// claim must be scoped to the data the deletion actually anonymizes, not an
// absolute "all PII" guarantee (developer-keyed PII the 9-step deletion does not
// scrub — organizations.billing_email, developers.notification_webhooks,
// tools.name/slug — survives in the primary DB and therefore in backups; that
// completeness gap is routed to the deletion-completeness follow-up).
const backupsFaq = region(
  docsSrc,
  'Can I request my data be removed from backups?',
  'How do I change my email address?',
)

// The accountDeletedEmail body+preheader — sliced from the export function to its
// preheader option so the honesty pins target this email's copy specifically.
const accountDeletedEmailSrc = region(
  emailSrc,
  'export function accountDeletedEmail(',
  'export function dataExportReadyEmail(',
)

/**
 * The forbidden legal CONCLUSIONS. The account-holder financial-retention
 * exemption does NOT cover the anonymous on-chain payer (V-N3 record §3), so
 * asserting any of these would be a NEW DC-16 false claim. We state the gap as
 * FACT (retained, un-scrubbed, erasure UNSETTLED) and never assert a basis.
 * Bare "lawful basis ... unsettled" is permitted — only an assertion that
 * retention is JUSTIFIED is banned. Banned as a CLASS (synonyms, not just the
 * one phrasing) so a reworded lawful-basis claim cannot slip past. Verified
 * none of these matches the honest "lawful basis ... unsettled (counsel
 * pending)" / "retained for 7 years per IRS and Stripe" wording.
 */
const BANNED_LEGAL_CONCLUSIONS: Array<[RegExp, string]> = [
  [/\bexempt\b/i, '"exempt"'],
  [/\bexemption\b/i, '"exemption"'],
  [/financial[- ]?retention exemption/i, '"financial-retention exemption"'],
  [/lawful basis (for|to) retain/i, '"lawful basis to/for retain"'],
  [/permitted to (retain|keep)/i, '"permitted to retain/keep"'],
  [/legally (entitled|allowed) to (retain|keep)/i, '"legally entitled/allowed to retain/keep"'],
  [/legitimate interest (in |to )?(retain|keep)/i, '"legitimate interest in retaining"'],
]

/**
 * The forbidden COMPREHENSIVE-SCRUB claims. The original DC-16 falsehood was
 * "PII scrubbed across all tables"; a future paraphrase ("wiped across the
 * database", "scrubbed from every table") is the SAME false claim. Banned as a
 * CLASS so a reworded regression cannot slip past a phrase-literal denylist.
 * Scoped to comprehensive cross-table scrub assertions — the honest "un-scrubbed"
 * / "does not scrub them" disclosures and the legitimate step-5 "Scrub IP/UA"
 * do NOT match (verified against the corrected docstring + FAQ).
 */
const BANNED_COMPREHENSIVE_SCRUB: Array<[RegExp, string]> = [
  [/all relevant tables/i, '"all relevant tables"'],
  [/across all tables/i, '"across all tables"'],
  [/PII is scrubbed/i, '"PII is scrubbed"'],
  [/scrubbed (from|across|in) (all|every)/i, '"scrubbed from/across/in all/every"'],
  [/(wiped|purged|erased)[^.]{0,24}(all|every) tables?/i, '"wiped/purged/erased ... all/every tables"'],
]

describe('V-N3 compliance-honesty — sanity / structural', () => {
  it('reads both source files non-trivially', () => {
    expect(complianceSrc.length).toBeGreaterThan(5000)
    expect(docsSrc.length).toBeGreaterThan(5000)
  })

  it('keeps ledger_entries in the resultUrl `retained` list (still retained, just no longer claimed scrubbed)', () => {
    expect(resultUrl).toMatch(/retained:\s*\[[^\]]*'ledger_entries'/)
  })

  it('preserves the processDataDeletion status-machine docstring block (edit was surgical)', () => {
    expect(docstring).toMatch(/Status machine \(H1, 2026-06-05\)/)
  })
})

describe('V-N3 compliance-honesty — A/B: docstring states the gap honestly', () => {
  // Non-vacuity for surface A/B: every PRESENT assertion here matches text that
  // exists ONLY in the corrected docstring; every ABSENT assertion matches the
  // OLD false phrasing. Reverting the docstring edit ⇒ this block goes RED.

  it('names ledger_entries and the two un-scrubbed payer-address column paths', () => {
    expect(docstring).toMatch(/ledger_entries/)
    expect(docstring).toMatch(/operation_id/)
    expect(docstring).toMatch(/metadata\.payer/)
  })

  it('discloses the anonymous payer EVM address is retained UN-scrubbed', () => {
    expect(docstring).toMatch(/payer/i)
    expect(docstring).toMatch(/EVM address/i)
    expect(docstring).toMatch(/un-?scrubbed/i)
  })

  it('routes the unsettled basis/erasure to V-N3-erasure (no conclusion asserted here)', () => {
    expect(docstring).toMatch(/V-N3-erasure/)
    expect(docstring).toMatch(/unsettled/i)
  })

  it('no longer claims a comprehensive cross-table scrub or that the records’ PII is scrubbed (class-banned, not just the old phrasing)', () => {
    for (const [re, label] of BANNED_COMPREHENSIVE_SCRUB) {
      expect(docstring, `docstring must not assert ${label}`).not.toMatch(re)
    }
  })

  it('asserts no forbidden lawful-basis conclusion', () => {
    for (const [re, label] of BANNED_LEGAL_CONCLUSIONS) {
      expect(docstring, `docstring must not assert ${label}`).not.toMatch(re)
    }
  })
})

describe('V-N3 compliance-honesty — C: resultUrl (persisted record) discloses the gap', () => {
  // Non-vacuity for surface C: retainedUnscrubbed + the two column paths exist
  // ONLY after the resultUrl edit. Reverting that edit ⇒ this block goes RED.

  it('carries a retainedUnscrubbed disclosure with column PATH names (never row values)', () => {
    expect(resultUrl).toMatch(/retainedUnscrubbed/)
    expect(resultUrl).toMatch(/'ledger_entries\.operation_id'/)
    expect(resultUrl).toMatch(/'ledger_entries\.metadata\.payer'/)
  })

  it('keeps retainedUnscrubbed a DISTINCT field — not folded into `anonymized` (which would re-imply a scrub)', () => {
    // The `anonymized` array (everything up to the `retained:` key) must not
    // list a ledger_entries field. End-marker is `retained:` rather than `]`
    // so the array's spread expressions don't truncate the slice early.
    const anonymizedArray = region(resultUrl, 'anonymized: [', 'retained:')
    expect(anonymizedArray).not.toMatch(/ledger_entries/)
  })

  it('pins the human-readable retainedUnscrubbedNote and its non-committal posture (no committed-erasure over-promise)', () => {
    // The note is the developer-facing honesty sentence in the persisted record
    // and was previously 100% unpinned (it could be blanked/inverted with the
    // file still GREEN). Slice ONLY the note value (between its key and the next
    // key) so this pins the note itself — not the adjacent source comment, which
    // also contains "unsettled".
    const note = region(resultUrl, 'retainedUnscrubbedNote:', 'toolCount:')
    expect(note).toMatch(/The fields above retain the anonymous on-chain payer.s EVM address/)
    expect(note).toMatch(/does not scrub them/i)
    // posture: state the gap as UNSETTLED — never promise a committed erasure
    expect(note).toMatch(/unsettled/i)
    expect(note).not.toMatch(/erasure is pending/i)
  })

  it('asserts no forbidden lawful-basis conclusion in the persisted record', () => {
    for (const [re, label] of BANNED_LEGAL_CONCLUSIONS) {
      expect(resultUrl, `resultUrl must not assert ${label}`).not.toMatch(re)
    }
  })
})

describe('V-N3 compliance-honesty — D: public FAQ drops the "across all tables" over-claim', () => {
  // Non-vacuity for surface D: "across all tables" exists ONLY in the OLD copy,
  // and the corrected developer-scoped framing exists ONLY after the edit.
  // Reverting the docs/page.tsx edit ⇒ this block goes RED.

  it('no longer claims a comprehensive cross-table scrub (class-banned; over-broad /all tables/ guard dropped to avoid false-RED on honest future copy)', () => {
    for (const [re, label] of BANNED_COMPREHENSIVE_SCRUB) {
      expect(gdprFaq, `public FAQ must not assert ${label}`).not.toMatch(re)
    }
  })

  it('scopes the claim to the developer’s own data and acknowledges retained financial records', () => {
    expect(gdprFaq).toMatch(/anonymize/i)
    expect(gdprFaq).toMatch(/referencing only your anonymized account/i)
    expect(gdprFaq).toMatch(/retained for 7 years/i)
  })

  // SLICE 2: drop the absolute "wherever it appears" completeness over-claim
  // (the on-chain payer address + organizations.billing_email are retained, so
  // "wherever it appears" over-promises). Non-vacuous: the phrase exists ONLY in
  // the OLD copy — reverting the :615 reword turns this RED.
  it('no longer claims anonymization happens "wherever it appears" (completeness over-claim)', () => {
    expect(gdprFaq).not.toMatch(/wherever it appears/i)
  })

  it('asserts no forbidden lawful-basis conclusion in the public copy', () => {
    for (const [re, label] of BANNED_LEGAL_CONCLUSIONS) {
      expect(gdprFaq, `public FAQ must not assert ${label}`).not.toMatch(re)
    }
  })
})

describe('V-N3 SLICE 2 — auth-user deletion is reflected in the record + docstring', () => {
  // Non-vacuity: each PRESENT assertion matches text that exists ONLY after the
  // SLICE-2 wiring/docstring edits. Reverting the wiring (or the docstring) ⇒ RED.

  it('docstring states the Supabase auth user is deleted (not just supabaseUserId nulled)', () => {
    expect(docstring).toMatch(/auth user/i)
    expect(docstring).toMatch(/deleteSupabaseAuthUser/)
  })

  it('docstring retry-safety proof accounts for the pre-txn idempotent auth-delete', () => {
    // The :376 'failed' RETRYABLE bullet must now reason about the auth-delete
    // being idempotent + pre-txn, not only transactional atomicity.
    expect(docstring).toMatch(/idempotent/i)
    expect(docstring).toMatch(/auth-?delete/i)
    expect(docstring).toMatch(/auth user deleted/i)
  })

  it('resultUrl anonymized array records the deleted Supabase auth user (gated on id present)', () => {
    // Sliced to the anonymized array (up to the `retained:` key) so this pins the
    // anonymized list specifically.
    const anonymizedArray = region(resultUrl, 'anonymized: [', 'retained:')
    expect(anonymizedArray).toMatch(/supabase_auth_user/)
  })
})

describe('V-N3 SLICE 2 — the "data retained after deletion" FAQ auth-records claim is now TRUE', () => {
  // This FAQ asserts "Supabase auth records are deleted". The behavioral fix
  // (hard-delete of auth.users) makes it true. Pin the claim survives — if a
  // future reword removes it without removing the behavior, or vice versa, this
  // surfaces the drift.
  it('still asserts the Supabase auth records are deleted', () => {
    expect(retainedAfterFaq).toMatch(/Supabase auth records are deleted/)
  })
})

describe('V-N3 SLICE 2 — accountDeletedEmail softens "permanently deleted" to honest copy', () => {
  // The account ROW persists (anonymized, deterministic deleted-<id>@ email kept
  // for FK integrity), so "permanently deleted" over-claimed. Non-vacuous: the
  // banned phrase exists ONLY in the OLD copy — reverting the email edit ⇒ RED.
  it('no longer claims the account was "permanently deleted" (anonymize-in-place)', () => {
    expect(accountDeletedEmailSrc).not.toMatch(/permanently deleted/i)
  })

  it('states the honest disposition: deleted + personal data anonymized', () => {
    expect(accountDeletedEmailSrc).toMatch(/has been deleted/i)
    expect(accountDeletedEmailSrc).toMatch(/anonymized/i)
  })
})

describe('V-N3 SLICE 2 (③ hardening) — sibling deletion-claim absolutes softened to match docs:615', () => {
  // docs:635 + docs:639 carried ABSOLUTE completeness claims ("all personally
  // identifiable information … anonymized", "your PII will no longer exist in any
  // backup") that over-read vs developer-keyed PII the deletion does NOT scrub
  // (organizations.billing_email, developers.notification_webhooks, tools.name/slug —
  // the behavioral scrub is routed to the deletion-completeness follow-up). The ③
  // deep audit softened the COPY to the scoped, honest framing matching docs:615 —
  // closing the DC-16 "partial fix leaves a sibling" recurrence. Non-vacuous: each
  // absolute existed ONLY in the OLD copy → reverting either reword turns these RED.
  it('docs:635 no longer claims "all personally identifiable information" is anonymized', () => {
    expect(retainedAfterFaq).not.toMatch(/all personally identifiable information/i)
    expect(retainedAfterFaq).toMatch(/the personal data that identifies you/i)
  })

  it('docs:639 no longer claims PII "will no longer exist in any backup" (absolute)', () => {
    expect(backupsFaq).not.toMatch(/no longer exist in any backup/i)
    expect(backupsFaq).toMatch(/anonymized on deletion/i)
  })
})
