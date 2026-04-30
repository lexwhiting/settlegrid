/**
 * P2.COMP1 — content-integrity tests for the compliance docs.
 *
 * docs/legal/*.md are load-bearing launch-defensibility artifacts:
 * external counsel, Stripe risk, and OFAC reviewers read them as
 * statements of SettleGrid's compliance commitments. These tests
 * guard against regressions that would silently weaken those
 * commitments:
 *
 *   - Required sections disappearing (e.g., someone removing the
 *     §8 Implementation Status block while rewriting §4 controls,
 *     which would put the docs back into "overclaims operational
 *     state" territory — exactly the H4/H5 finding from hostile
 *     review).
 *   - Dangling cross-references (broken links to sibling docs).
 *   - Factual-claim regressions (e.g., the incorrect "$1.37M per
 *     violation" IEEPA figure sneaking back in).
 *   - Spec-literal redirect stubs pointing at the wrong canonical.
 *
 * These are content tests, not code tests — markdown files don't
 * compile or execute. The honest framing: if these tests pass, the
 * compliance docs still meet the P2.COMP1 spec + the hostile-review
 * fixes. If they fail, someone edited a doc in a way that rolls
 * back a compliance guarantee — re-review before merging.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../../../../..')
const legalDir = join(repoRoot, 'docs/legal')

function readDoc(filename: string): string {
  return readFileSync(join(legalDir, filename), 'utf8')
}

/* -------------------------------------------------------------------------- */
/*  File presence — DoD item 1 + gate check 19                                 */
/* -------------------------------------------------------------------------- */

describe('P2.COMP1 — file presence (DoD + gate-check paths)', () => {
  const canonicalDocs = [
    'ofac-program.md',
    'acceptable-use-policy.md',
    'incident-response-playbook.md',
  ]

  it.each(canonicalDocs)(
    'canonical %s exists (picked up by gate check 19)',
    (filename) => {
      expect(existsSync(join(legalDir, filename))).toBe(true)
    },
  )

  const specLiteralStubs = ['ofac-compliance-program.md', 'aup.md']

  it.each(specLiteralStubs)(
    'spec-literal redirect stub %s exists',
    (filename) => {
      expect(existsSync(join(legalDir, filename))).toBe(true)
    },
  )

  it('redirect stubs link to the correct canonical file', () => {
    const ofacStub = readDoc('ofac-compliance-program.md')
    expect(ofacStub).toMatch(/\[`ofac-program\.md`\]\(\.\/ofac-program\.md\)/)

    const aupStub = readDoc('aup.md')
    expect(aupStub).toMatch(
      /\[`acceptable-use-policy\.md`\]\(\.\/acceptable-use-policy\.md\)/,
    )
  })

  it('supporting docs referenced by the compliance program exist', () => {
    const referenced = [
      'ofac-training-log.md',
      'lawyer-engagement-log.md',
      'backup-mor-sop.md',
    ]
    for (const f of referenced) {
      expect(existsSync(join(legalDir, f))).toBe(true)
    }
  })
})

/* -------------------------------------------------------------------------- */
/*  OFAC program — required content sections                                   */
/* -------------------------------------------------------------------------- */

describe('P2.COMP1 — ofac-program.md required content', () => {
  const ofac = readDoc('ofac-program.md')

  it.each([
    ['Purpose + legal basis', /^##\s*1\.\s*Purpose/m],
    ['Management commitment', /^##\s*2\.\s*Management commitment/m],
    ['Risk assessment', /^##\s*3\.\s*Risk assessment/m],
    ['Internal controls', /^##\s*4\.\s*Internal controls/m],
    ['Testing + auditing', /^##\s*5\.\s*Testing/m],
    ['Escalation + voluntary self-disclosure', /^##\s*6\.\s*Escalation/m],
    ['Training + review schedule', /^##\s*7\.\s*Training/m],
    ['Implementation status (hostile-review §8)', /^##\s*8\.\s*Implementation status/m],
    ['Contact + records', /^##\s*9\.\s*Contact/m],
  ])('has section "%s"', (_label, re) => {
    expect(ofac).toMatch(re)
  })

  it('designates the compliance officer (spec DoD requirement)', () => {
    expect(ofac).toMatch(/Compliance officer:\*\*\s*Lex Whiting/)
  })

  it('describes onboarding-time SDN screening', () => {
    expect(ofac).toMatch(/Specially Designated Nationals/)
    expect(ofac).toMatch(/onboarding/i)
  })

  it('describes monthly re-screening cron cadence', () => {
    expect(ofac).toMatch(/monthly/i)
    expect(ofac).toMatch(/re-screening/i)
  })

  it('references the Treasury sanctions search / SDN download URL', () => {
    // Either the SDN list URL (authoritative for programmatic access)
    // OR the public search tool — both are documented.
    const hasSdnListUrl = /specially-designated-nationals-and-blocked-persons-list/.test(
      ofac,
    )
    const hasSearchUrl = /sanctionssearch\.ofac\.treas\.gov/.test(ofac)
    expect(hasSdnListUrl || hasSearchUrl).toBe(true)
  })

  it('includes escalation path + voluntary self-disclosure timing', () => {
    expect(ofac).toMatch(/Within 1 hour/)
    expect(ofac).toMatch(/Within 24 hours/)
    expect(ofac).toMatch(/voluntary self-disclosure/i)
    expect(ofac).toMatch(/50%/) // up-to-50% penalty reduction
  })

  it('periodic review schedule includes annual cadence', () => {
    expect(ofac).toMatch(/Annual/i)
    expect(ofac).toMatch(/next:\s*2027-04-18/i)
  })

  it('links to the training log file', () => {
    expect(ofac).toContain('docs/legal/ofac-training-log.md')
  })
})

describe('P2.COMP1 — ofac-program.md factual-accuracy regression guards', () => {
  const ofac = readDoc('ofac-program.md')

  it('does NOT assert the incorrect "$1.37M per violation" IEEPA figure', () => {
    // Hostile-review III found that the actually-published 2024
    // IEEPA cap is ~$377K, not $1.37M. Regression guard.
    expect(ofac).not.toMatch(/\$1\.37M per violation/)
    expect(ofac).not.toMatch(/\$1,370,000/)
  })

  it('references OFAC\'s authoritative civil-penalty URL', () => {
    expect(ofac).toContain('ofac.treasury.gov/civil-penalties')
  })

  it('cites 50 USC § 1705 (IEEPA) as the statutory basis', () => {
    expect(ofac).toMatch(/50\s+USC\s+§?\s*1705/)
  })

  it('does NOT assert the fabricated /disclosure URL', () => {
    // Hostile-review III: ofac.treasury.gov/disclosure doesn't
    // resolve. Superseded by the eCFR + contact-page citations.
    expect(ofac).not.toMatch(/ofac\.treasury\.gov\/disclosure\b/)
  })

  it('cites 31 CFR Part 501 Appendix A (Economic Sanctions Enforcement Guidelines)', () => {
    expect(ofac).toMatch(/31\s+CFR\s+Part\s+501/)
    expect(ofac).toMatch(/Appendix\s+A/i)
  })
})

describe('P2.COMP1 — ofac-program.md implementation-honesty guards', () => {
  const ofac = readDoc('ofac-program.md')

  it('§8 Implementation Status exists (prevents regression to overclaim)', () => {
    expect(ofac).toMatch(/##\s*8\.\s*Implementation status/)
  })

  it('§8 names the not-yet-wired controls in a table', () => {
    expect(ofac).toMatch(/Not yet wired/i)
    expect(ofac).toMatch(/Phase 3/i)
  })

  it('§4.1 uses commitment voice (MUST / WILL), not present-tense "runs"', () => {
    // Avoid the hostile-review H4/H5 regression where the onboarding
    // SDN check was described as "runs synchronously in the
    // registration handler" while it wasn't actually shipped.
    expect(ofac).toMatch(/MUST be screened/)
  })

  it('§4.2 uses "WILL run" (not asserting the monthly cron is live)', () => {
    expect(ofac).toMatch(/WILL run a monthly/)
  })
})

/* -------------------------------------------------------------------------- */
/*  AUP — required content sections + AI-specific prohibitions                 */
/* -------------------------------------------------------------------------- */

describe('P2.COMP1 — acceptable-use-policy.md required content', () => {
  const aup = readDoc('acceptable-use-policy.md')

  it.each([
    ['Scope', /^##\s*1\.\s*Scope/m],
    ['Prohibited business categories', /^##\s*2\.\s*Prohibited business categories/m],
    ['Content restrictions', /^##\s*3\.\s*Content restrictions/m],
    ['Technical abuse', /^##\s*4\.\s*Technical abuse/m],
    ['Enforcement process', /^##\s*5\.\s*Enforcement process/m],
    ['Amendments', /^##\s*6\.\s*Amendments/m],
    ['Contact', /^##\s*7\.\s*Contact/m],
  ])('has section "%s"', (_label, re) => {
    expect(aup).toMatch(re)
  })

  it('prohibits comprehensive-sanction jurisdictions', () => {
    for (const jurisdiction of [
      'Cuba',
      'Iran',
      'North Korea',
      'Syria',
      'Crimea',
    ]) {
      expect(aup).toContain(jurisdiction)
    }
  })

  it('has the AI-specific prohibitions (§2.3 — added beyond Stripe\'s list)', () => {
    expect(aup).toMatch(/Non-consensual intimate imagery/i)
    expect(aup).toMatch(/deepfake/i)
    expect(aup).toMatch(/CSAM/i)
    expect(aup).toMatch(/CBRN/i)
    expect(aup).toMatch(/bioweapon/i)
  })

  it('cites the CSAM reporting statute (18 USC § 2258A)', () => {
    expect(aup).toMatch(/18\s+USC\s+§?\s*2258A/)
  })

  it('links to Stripe\'s Restricted Businesses List', () => {
    expect(aup).toContain('stripe.com/legal/restricted-businesses')
  })

  it('addresses the Polar-AUP-mirror spec requirement (post-Pattern-A+)', () => {
    // Spec said "mirror Stripe AND Polar AUPs". Polar abandoned
    // per Pattern A+. The note explaining this must stay.
    expect(aup).toMatch(/Polar AUP note/)
    expect(aup).toMatch(/Pattern A\+/)
  })

  it('enforcement is graduated (Notice / Hold / Termination)', () => {
    expect(aup).toMatch(/Notice\./)
    expect(aup).toMatch(/Hold\./)
    expect(aup).toMatch(/Termination\./)
  })

  it('30-day appeal window with SDN-false-positive priority', () => {
    expect(aup).toMatch(/30 days/)
    expect(aup).toMatch(/SDN[- ]list false positives/)
    expect(aup).toMatch(/72 hours/)
  })
})

/* -------------------------------------------------------------------------- */
/*  Incident response playbook — one-pager + 5 scenarios + Pattern A+ pivot    */
/* -------------------------------------------------------------------------- */

describe('P2.COMP1 — incident-response-playbook.md required content', () => {
  const ir = readDoc('incident-response-playbook.md')

  it('has the one-pager section (spec required "one-page runbook")', () => {
    expect(ir).toMatch(/One-page runbook/)
  })

  it('one-pager includes a 5-row scenario table', () => {
    // Each scenario A–E should be identifiable in the table row.
    expect(ir).toMatch(/\|\s*\*\*A\*\*/)
    expect(ir).toMatch(/\|\s*\*\*B\*\*/)
    expect(ir).toMatch(/\|\s*\*\*C\*\*/)
    expect(ir).toMatch(/\|\s*\*\*D\*\*/)
    expect(ir).toMatch(/\|\s*\*\*E\*\*/)
  })

  it.each([
    ['Scenario A — Stripe de-platforms SettleGrid', /Scenario A — Stripe de-platforms/],
    ['Scenario B — manual review', /Scenario B — Stripe forces manual review/],
    ['Scenario C — FL/NJ enforcement', /Scenario C — Florida or New Jersey enforcement/],
    ['Scenario D — OFAC violation', /Scenario D — OFAC violation/],
    ['Scenario E — chargeback cascade', /Scenario E — Chargeback cascade/],
  ])('has detailed section for %s', (_label, re) => {
    expect(ir).toMatch(re)
  })

  it('Scenario A documents the Polar → Stripe pivot per Pattern A+', () => {
    expect(ir).toMatch(/Pattern A\+/)
    expect(ir).toMatch(/Polar rail.*abandoned/i)
  })

  it('Scenario D cites OFAC voluntary-disclosure process + 50% penalty reduction', () => {
    // The voluntary-disclosure package reference + the 50%
    // mitigation figure are both load-bearing operationally.
    expect(ir).toMatch(/voluntary[- ]disclosure/i)
    expect(ir).toMatch(/50%/)
  })

  it('Scenario D does NOT repeat the incorrect $1.37M figure', () => {
    expect(ir).not.toMatch(/\$1\.37M/)
  })

  it('first-hour checklist has four steps', () => {
    expect(ir).toMatch(/1\.\s+Identify/)
    expect(ir).toMatch(/2\.\s+Contain/)
    expect(ir).toMatch(/3\.\s+Notify/)
    expect(ir).toMatch(/4\.\s+Log/)
  })

  it('maps scenario labels A–E back to compliance-posture.md', () => {
    expect(ir).toMatch(/compliance-posture\.md/)
  })
})

/* -------------------------------------------------------------------------- */
/*  Cross-reference integrity — every docs/legal/*.md link resolves            */
/* -------------------------------------------------------------------------- */

describe('P2.COMP1 — no dangling cross-references between compliance docs', () => {
  const compDocs = [
    'ofac-program.md',
    'acceptable-use-policy.md',
    'incident-response-playbook.md',
    'ofac-compliance-program.md',
    'aup.md',
    'ofac-training-log.md',
    'lawyer-engagement-log.md',
    'backup-mor-sop.md',
  ]

  it.each(compDocs)(
    '%s — every docs/legal/*.md cross-reference resolves',
    (filename) => {
      const src = readDoc(filename)
      // Match `docs/legal/<file>.md` in prose + `./<file>.md` in
      // same-directory markdown-link form.
      const absoluteRefs = [...src.matchAll(/docs\/legal\/([a-z0-9_-]+\.md)/gi)]
      const relativeRefs = [
        ...src.matchAll(/\]\(\.\/([a-z0-9_-]+\.md)\)/gi),
      ]
      const allTargets = new Set<string>([
        ...absoluteRefs.map((m) => m[1]),
        ...relativeRefs.map((m) => m[1]),
      ])
      for (const target of allTargets) {
        const exists = existsSync(join(legalDir, target))
        expect(exists, `${filename} references ${target} which doesn't exist`).toBe(
          true,
        )
      }
    },
  )
})

/* -------------------------------------------------------------------------- */
/*  Lawyer engagement log — evidences "kicked off"                             */
/* -------------------------------------------------------------------------- */

describe('P2.COMP1 — lawyer-engagement-log.md evidences engagement kickoff (spec DoD)', () => {
  const log = readDoc('lawyer-engagement-log.md')

  it('has an active engagement entry (E-001)', () => {
    expect(log).toMatch(/### E-001/)
  })

  it('E-001 scope covers OFAC + AUP + ToS review', () => {
    expect(log).toMatch(/OFAC compliance program review/)
    expect(log).toMatch(/AUP review/)
    expect(log).toMatch(/Terms of Service review/)
  })

  it('E-001 was kicked off (has a kickoff date in the timeline)', () => {
    expect(log).toMatch(/2026-04-18/)
    expect(log).toMatch(/Engagement opened/)
  })
})
