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
// absolute "all PII" guarantee. (V-N3 SLICE 3 now scrubs the developer's
// notification_webhooks, marketing-waitlist signups, audit-log details, and tool
// infra fields; what remains UN-scrubbed in the primary DB — and therefore in
// backups — is organizations.billing_email (a distinct entity, deferred) and
// tools.name/slug (retained-by-design product identity).)
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

describe('V-N3 SLICE 3 — the completeness scrubs are disclosed in the persisted record (C)', () => {
  // Non-vacuity: each path string exists ONLY after the SLICE-3 resultUrl edit.
  // Reverting a scrub's disclosure entry ⇒ the matching assertion goes RED.
  // (Runtime gating — toolIds>0, deletedWaitlist — is pinned behaviorally in
  // compliance-deletion-auth.test.ts; these are SOURCE-TEXT presence pins per §7-E5.)

  // Sliced to the anonymized array (up to the `retained:` key) so these pin the
  // anonymized list specifically (compatible with the existing
  // `.not.toMatch(/ledger_entries/)` + `/supabase_auth_user/` slice — no collision).
  const anonymizedArray = region(resultUrl, 'anonymized: [', 'retained:')

  it('anonymized records developers.notification_webhooks + audit_logs.details (unconditional scrubs)', () => {
    expect(anonymizedArray).toMatch(/'developers\.notification_webhooks'/)
    expect(anonymizedArray).toMatch(/'audit_logs\.details'/)
  })

  it('anonymized records waitlist_signups (gated on rows deleted at runtime)', () => {
    expect(anonymizedArray).toMatch(/'waitlist_signups'/)
  })

  it('anonymized records the tools PII-infra column paths (gated on toolIds at runtime)', () => {
    expect(anonymizedArray).toMatch(/'tools\.source_repo_url'/)
    expect(anonymizedArray).toMatch(/'tools\.proxy_endpoint'/)
    expect(anonymizedArray).toMatch(/'tools\.crawl_metadata'/)
  })

  // V-N3 SLICE 3 RECOVERY (F-2): the developer's own review responses are now
  // disclosed (gated on toolIds at runtime; gating proven behaviorally in
  // compliance-deletion-auth.test.ts). Source-text presence pin per §7-E5.
  it('anonymized records tool_reviews.developer_response (gated on toolIds at runtime)', () => {
    expect(anonymizedArray).toMatch(/'tool_reviews\.developer_response'/)
  })

  it('keeps the new scrub paths OUT of retainedUnscrubbed (they were scrubbed, not retained)', () => {
    const retainedUnscrubbedArray = region(resultUrl, 'retainedUnscrubbed: [', 'retainedUnscrubbedNote:')
    expect(retainedUnscrubbedArray).not.toMatch(/notification_webhooks/)
    expect(retainedUnscrubbedArray).not.toMatch(/waitlist_signups/)
    expect(retainedUnscrubbedArray).not.toMatch(/audit_logs\.details/)
    expect(retainedUnscrubbedArray).not.toMatch(/source_repo_url/)
    // F-2: the developer_response was SCRUBBED — it must not be mislabeled retained.
    expect(retainedUnscrubbedArray).not.toMatch(/developer_response/)
  })
})

describe('V-N3 SLICE 3 RECOVERY — F-1: audit_logs.details scrub is broadened to back the UNCONDITIONAL claim', () => {
  // The unconditional 'audit_logs.details' disclosure is only HONEST because the
  // step-5 scrub now reaches the consumer-twin (consumerId-keyed) and
  // cross-principal (resourceType/resourceId-keyed) rows in addition to the
  // developerId-keyed rows. These source-text pins guard the broadened scrub
  // PREDICATES exist in source (the runtime predicate firing is pinned
  // behaviorally in compliance-deletion-auth.test.ts). Non-vacuous: reverting the
  // 5b/5c additions removes these clauses → RED.
  const deletionBody = region(complianceSrc, 'async function processDataDeletion', '} catch (err) {')

  it('still discloses audit_logs.details UNCONDITIONALLY (the claim the broadened scrub backs)', () => {
    const anonymizedArray = region(resultUrl, 'anonymized: [', 'retained:')
    expect(anonymizedArray).toMatch(/'audit_logs\.details'/)
  })

  it('scrubs the consumer twin’s consumerId-keyed audit rows (step 5b)', () => {
    expect(deletionBody).toMatch(/auditLogs\.consumerId/)
  })

  it('scrubs cross-principal rows naming the subject as a developer/developer_signup resource (step 5c)', () => {
    expect(deletionBody).toMatch(/inArray\(\s*auditLogs\.resourceType,\s*\['developer',\s*'developer_signup'\]\s*\)/)
    expect(deletionBody).toMatch(/eq\(auditLogs\.resourceId,\s*developerId\)/)
  })
})

describe('V-N3 SLICE 3 — organizations.billing_email is DEFERRED + disclosed honestly (F)', () => {
  // §7-F: a column PATH in retainedUnscrubbed (DC-11, never a value) + the org
  // posture folded into the SINGLE retainedUnscrubbedNote, with NO banned legal
  // conclusion. Non-vacuous: the path + the distinct-entity wording exist ONLY
  // after the SLICE-3 edit; reverting either turns this RED.
  const retainedUnscrubbedArray = region(resultUrl, 'retainedUnscrubbed: [', 'retainedUnscrubbedNote:')
  const note = region(resultUrl, 'retainedUnscrubbedNote:', 'toolCount:')

  it('lists organizations.billing_email in retainedUnscrubbed as a column PATH', () => {
    expect(retainedUnscrubbedArray).toMatch(/'organizations\.billing_email'/)
  })

  it('the note frames it as a distinct entity (an organization), routed separately', () => {
    expect(note).toMatch(/distinct entity/i)
    expect(note).toMatch(/organization/i)
    expect(note).toMatch(/routed separately/i)
  })

  it('the note asserts NO forbidden lawful-basis conclusion (banned CLASS still clean)', () => {
    for (const [re, label] of BANNED_LEGAL_CONCLUSIONS) {
      expect(note, `org note must not assert ${label}`).not.toMatch(re)
    }
  })

  it('preserves the existing ledger_entries un-scrubbed disclosure verbatim (added to, not reworded)', () => {
    // §1: the V-N3-erasure ledger disclosure is frozen — the SLICE-3 org clause
    // is APPENDED, the ledger sentence is untouched.
    expect(note).toMatch(/The fields above retain the anonymous on-chain payer.s EVM address/)
    expect(retainedUnscrubbedArray).toMatch(/'ledger_entries\.operation_id'/)
    expect(retainedUnscrubbedArray).toMatch(/'ledger_entries\.metadata\.payer'/)
  })
})

describe('V-N3-enable-disclosure — invocations.metadata erasure is documented + disclosed honestly', () => {
  // Non-vacuity: the docstring contrast paragraph and THIS source-text pin are
  // added by this chunk; the resultUrl `anonymized: ['invocations.metadata']`
  // entry they document PRE-EXISTED (this chunk only makes its coverage explicit).
  // Reverting the docstring paragraph ⇒ test 1 RED; removing that pre-existing
  // entry ⇒ test 2 RED. (The behavioral coupling to step 4 actually running is
  // pinned in compliance-deletion-auth.test.ts; these are SOURCE-TEXT presence
  // pins per the same A/B + C surface split as the rest of this file.)
  //
  // The new docstring prose is ALSO covered by the existing whole-docstring banned
  // scans (BANNED_COMPREHENSIVE_SCRUB at the A/B block, BANNED_LEGAL_CONCLUSIONS
  // there + over the whole resultUrl) — so a banned phrase in the new text turns
  // those RED. No duplicate scan is added here.

  it('A/B docstring documents that step 4 nulls invocations.metadata (removing the captured on-chain payer)', () => {
    // UNIQUE to the new paragraph: the frozen ledger text uses `metadata.payer`,
    // never `invocations.metadata`; the SLICE-5 paragraph uses invocations.referralCode.
    expect(docstring).toMatch(/INVOCATIONS PAYER \(contrast\)/)
    expect(docstring).toMatch(/nulls the entire `invocations\.metadata`/)
  })

  it('C resultUrl anonymized array names invocations.metadata (gated on toolIds at runtime)', () => {
    // No such pin existed before this chunk. End-marker is `retained:` so the
    // array's spread expressions are not truncated early (mirrors the existing
    // anonymizedArray slices). Non-vacuous: removing the :865 entry ⇒ RED.
    const anonymizedArray = region(resultUrl, 'anonymized: [', 'retained:')
    expect(anonymizedArray).toMatch(/'invocations\.metadata'/)
  })
})

describe('V-N3-deletion-cascade — revoke-not-delete + retained invocation linkage disclosed honestly', () => {
  // The chunk that makes the deletion KEEP invocation rows: steps 2-3 REVOKE (not
  // delete) the api_keys so the invocations.api_key_id ON DELETE CASCADE never
  // fires; the surviving foreign-tool rows are disclosed as retained-pseudonymous.
  // The new docstring + note prose is ALSO covered by the whole-docstring
  // BANNED_COMPREHENSIVE_SCRUB scan (A/B block) + the whole-resultUrl
  // BANNED_LEGAL_CONCLUSIONS scan (C block) — a banned phrase there turns those RED.
  const deletionBody = region(complianceSrc, 'async function processDataDeletion', '} catch (err) {')
  const retainedUnscrubbedArray = region(resultUrl, 'retainedUnscrubbed: [', 'retainedUnscrubbedNote:')
  const note = region(resultUrl, 'retainedUnscrubbedNote:', 'toolCount:')

  it('A/B docstring documents that invocation rows SURVIVE because the api_keys are REVOKED, not deleted', () => {
    expect(docstring).toMatch(/INVOCATION ROWS SURVIVE/)
    expect(docstring).toMatch(/REVOKE the api_keys/)
    expect(docstring).toMatch(/ON DELETE CASCADE/)
  })

  it('steps 2-3 REVOKE (update status=revoked) the api_keys instead of deleting them', () => {
    // Non-vacuous: a regression back to tx.delete(apiKeys) drops the revoke update
    // AND re-introduces the banned .delete(apiKeys) (the cascade footgun).
    expect(deletionBody).toMatch(/\.update\(apiKeys\)\s*\.set\(\{ status: 'revoked', ipAllowlist: null \}\)/)
    expect(deletionBody).not.toMatch(/\.delete\(apiKeys\)/)
  })

  it('retainedUnscrubbed names the surviving invocation linkage column PATHS (DC-11)', () => {
    expect(retainedUnscrubbedArray).toMatch(/'invocations\.consumer_id'/)
    expect(retainedUnscrubbedArray).toMatch(/'invocations\.api_key_id'/)
    // F3 RULING: session_id + referral_code RETAINED (referral_code anchors a
    // foreign developer's commission) and disclosed alongside — no new scrub.
    expect(retainedUnscrubbedArray).toMatch(/'invocations\.session_id'/)
    expect(retainedUnscrubbedArray).toMatch(/'invocations\.referral_code'/)
  })

  it('does NOT double-list invocations.metadata in retainedUnscrubbed (single-bucket; it lives under anonymized)', () => {
    expect(retainedUnscrubbedArray).not.toMatch(/'invocations\.metadata'/)
    const anonymizedArray = region(resultUrl, 'anonymized: [', 'retained:')
    expect(anonymizedArray).toMatch(/'invocations\.metadata'/)
  })

  it('the note frames the surviving invocations as retained-pseudonymous (not erased), basis unsettled', () => {
    expect(note).toMatch(/Invocation rows on other developers' tools/)
    expect(note).toMatch(/pseudonymi[sz]e/i)
    expect(note).toMatch(/not erased/i)
    expect(note).toMatch(/unsettled \(counsel pending\)/i)
    // §11 F4 / §1: the frozen ledger-payer sentence is PRESERVED verbatim (added
    // to, not reworded) — also pinned at the C block :245.
    expect(note).toMatch(/The fields above retain the anonymous on-chain payer.s EVM address/)
  })

  it('the note discloses that foreign-tool invocations.metadata is RETAINED un-scrubbed (step 4 nulls only own-tool metadata)', () => {
    // ② seal finding (DC-16): revoke-not-delete makes foreign-tool invocation rows
    // SURVIVE with metadata un-scrubbed (step 4 scopes to the subject's own toolIds),
    // and that metadata can hold the captured on-chain payer (the subject's own EVM
    // address). `anonymized: ['invocations.metadata']` is own-tool-scoped, so the
    // foreign-tool retention MUST be disclosed in the note prose (single-bucket — NOT
    // a second bucket entry) or the column reads as fully anonymized when it is not.
    expect(note).toMatch(/invocations\.metadata is nulled \(step 4\) only on the subject.s own tools/)
    expect(note).toMatch(/retained un-?scrubbed and may hold the captured on-chain payer/i)
  })
})

describe('V-N3-deletion-wiring — F-B1: deactivate-before-scrub + the in-flight residual are disclosed honestly', () => {
  // The wiring chunk activates processDataDeletion and adds the F-B1 pre-commit
  // (revoke api_keys + mark the subject's tools deleted BEFORE the scrub txn). That
  // pre-commit (a) makes the sealed atomicity docstring's "pristine on failed" claim
  // FALSE — §13.3 authorizes amending it — and (b) leaves a bounded ≤~90s in-flight
  // residual that the positive `anonymized: ['invocations.metadata']` claim would
  // overstate without a note — §13.2(A) authorizes re-scoping the disclosure freeze
  // to add `anonymizedNote`. These pins back both honesty amendments. Non-vacuous:
  // reverting the docstring qualifier or removing anonymizedNote turns this RED.
  const deletionBody = region(complianceSrc, 'async function processDataDeletion', '} catch (err) {')

  it('A/B docstring documents the F-B1 deactivate-before-scrub pre-commit', () => {
    expect(docstring).toMatch(/F-B1/)
    expect(docstring).toMatch(/PRE-COMMIT|pre-commit/)
    expect(docstring).toMatch(/before the scrub/i)
  })

  it('A/B docstring no longer claims a strictly pristine DB on failed (acknowledges the committed deactivation)', () => {
    // §13.3: after a committed pre-commit, 'failed' is NOT pristine — keys revoked +
    // tools deactivated. The amended text must qualify "pristine" with that exception.
    expect(docstring).toMatch(/pristine EXCEPT/)
    expect(docstring).toMatch(/DEACTIVATED, not/)
  })

  it('A/B docstring honestly SCOPES "DEACTIVATED" to after the pre-commit commits (a pre-commit failure leaves the account live)', () => {
    // ② seal fix (DC-16): the "DEACTIVATED, not live" guarantee is FALSE for a failure
    // BEFORE the F-B1 pre-commit (e.g. the pre-txn auth-delete throws) — the account is
    // then still live. The docstring must scope the claim, not overstate it as blanket.
    expect(docstring).toMatch(/still LIVE/)
    expect(docstring).toMatch(/once \(b\) commits|once the pre-commit/i)
  })

  it('the F-B1 pre-commit is a SEPARATE db.transaction placed BEFORE the scrub txn (source-text)', () => {
    // The deactivation must commit independently of the scrub (so a scrub rollback
    // leaves the account deactivated). Pin the two distinct pre-commit writes exist
    // in source: the api_keys revoke and the tools status='deleted'. The behavioral
    // independence is pinned in compliance-deletion-cascade.integration.test.ts
    // (the forced-rollback test). Non-vacuous: deleting the pre-commit block ⇒ RED.
    expect(deletionBody).toMatch(/await db\.transaction\(async \(preTx\)/)
    expect(deletionBody).toMatch(/preTx\s*\n?\s*\.update\(tools\)\s*\n?\s*\.set\(\{ status: 'deleted' \}\)/)
  })

  it('C resultUrl carries an anonymizedNote disclosing the bounded ≤~90s in-flight metadata residual', () => {
    // §13.2(A): the own-tool invocations.metadata claim is a positive "nulled" claim;
    // the in-flight residual (a request authed before the pre-commit, ≤ proxy ~90s)
    // must be named, not hidden (DC-16). Pin distinctive phrasing unique to this note.
    expect(resultUrl).toMatch(/anonymizedNote:/)
    expect(resultUrl).toMatch(/in flight at deletion/i)
    expect(resultUrl).toMatch(/~90s|90s max/i)
    expect(resultUrl).toMatch(/retained until purged by the scheduled data-retention job/i)
    // ② seal fix (DC-16): "until purged" overstates for a tool owner whose log-retention
    // is keep-forever (the cron purge is gated logRetentionDays>0, so it never runs). The
    // note must name that case rather than promise an eventual purge that won't happen.
    expect(resultUrl).toMatch(/keep-forever|indefinitely/i)
  })

  it('the anonymizedNote asserts no forbidden lawful-basis conclusion (banned CLASS clean)', () => {
    const note = resultUrl.slice(resultUrl.indexOf('anonymizedNote:'))
    for (const [re, label] of BANNED_LEGAL_CONCLUSIONS) {
      expect(note, `anonymizedNote must not assert ${label}`).not.toMatch(re)
    }
  })
})
