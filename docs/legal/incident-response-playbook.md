# Incident Response Playbook

**Document owner:** SettleGrid (Alerterra, LLC)
**Compliance officer:** Lex Whiting (founder)
**Effective date:** 2026-04-18
**Review cadence:** Annually + after any actual or near-miss incident

---

## One-page runbook (print-and-keep-by-keyboard)

> This is the scannable summary the P2.COMP1 spec asked for. Detailed procedures for each scenario are in §1–§5 below.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  FIRST HOUR — ALL INCIDENTS                                                   │
│  1. Identify the scenario (A–E below). Unknown → §6, escalate.                │
│  2. Contain (pause whatever the scenario calls for).                          │
│  3. Notify — counsel ≤2h if regulatory (A/C/D); Stripe ≤4h if A/B/E.          │
│  4. Log — open docs/legal/incidents/YYYY-MM-DD-<scenario>.md; UTC timestamps. │
└───────────────────────────────────────────────────────────────────────────────┘
```

| # | Scenario | Trigger | Pause | Notify | First deliverable |
|---|---|---|---|---|---|
| **A** | **Stripe de-platforms SettleGrid** (replaces spec's "Polar terminates" — Polar rail abandoned per Pattern A+) | Stripe risk email citing Restricted Businesses / Connect Platform Agreement; sudden payout hold; chargeback rate crossing 0.4% aggregate | New developer onboarding; new subscriptions. Do NOT pause existing subscriptions (creates chargeback risk). | Counsel ≤2h. Respond to Stripe ≤4h with numbered facts. | Counsel-vetted response to Stripe within 24h; backup-MoR activation within 48h if de-platforming confirmed |
| **B** | **Stripe forces manual review** | Volume/chargeback spike; dashboard banner; risk-team documentation request | New developer onboarding (velocity cap); no public-channel responses | Stripe ≤1h ack; counsel on-call (engage if Connect Platform Agreement breach hinted) | Documentation package — ToS, AUP, OFAC program, chargeback trend, sample charges — within 24h |
| **C** | **FL/NJ enforcement action** | Cease-and-desist; subpoena; consumer complaint alleging unlicensed money transmission | **NOT operations.** Pausing can be framed as admitting jurisdiction. Counsel decides. | **Counsel within 2h — no direct response.** Every comms goes through counsel. | Counsel-drafted factual response citing agent-of-payee analysis; 10–30 day window |
| **D** | **OFAC violation** | Monthly re-screen hit; onboarding-match escalation; third-party report; OFAC inquiry | Developer account — stop payouts, block subscriptions. Immediate, before counsel. | Counsel ≤2h. Stripe proactive notification same day. **Do not email developer yet.** | Voluntary self-disclosure package via https://ofac.treasury.gov/disclosure (counsel submits, up to 50% penalty reduction), within 5 business days |
| **E** | **Chargeback cascade** | Velocity alert ≥0.5% platform; single-developer >1% in 7 days; Stripe Managed Risk flag | Implicated developer account (Hold per AUP §5.2); consider platform-wide onboarding freeze in the implicated category | Stripe proactive (≤4h); counsel if exposure ≥$10K | Source triage (single developer vs platform-wide); rolling-reserve activation; refund-resolution outreach to affected consumers |

**Decision shortcuts:**

- **"Do I email the developer?"** — NO in Scenarios C + D until counsel approves. YES in Scenarios A/B/E (with coordinator involvement) for operational updates.
- **"Do I pause payouts?"** — YES in Scenarios A (platform-wide if needed), D (implicated developer), E (implicated developer + category). NO in C (pausing admits jurisdiction).
- **"Is this public?"** — Assume NO until counsel says YES. Premature disclosure is a one-way door.
- **"Who writes the response?"** — Scenarios A/B: compliance officer can draft, counsel reviews. Scenarios C/D: counsel drafts, compliance officer reviews. Scenario E: operations, no external response required beyond Stripe.

**Mapping to compliance-posture.md:** Scenario labels A–E match `private/master-plan/compliance-posture.md` §"Failure mode scenarios". Scenario A was originally "Polar terminates"; the Pattern A+ pivot (2026-04-14) replaced the Polar rail with Stripe-only + pre-arranged backup MoR. The backup MoR (Paddle or Lemon Squeezy) is the contingency that replaces the Polar-rail insurance from the original analysis.

---

## 0. First-responder checklist

Hit all four in the first hour (this is the detailed version of the one-pager above):

1. **Identify + classify** — match to one of the five scenarios (§1–§5). If it doesn't match, add a §6 entry and escalate.
2. **Contain** — pause whatever the scenario calls for (account, payouts, signups, rail).
3. **Notify** — counsel within 2 hours if the scenario is regulatory (A/C/D); Stripe within 4 hours if the scenario involves Stripe risk (B/E).
4. **Log** — open `docs/legal/incidents/YYYY-MM-DD-<scenario>.md` and log every step with UTC timestamps.

---

## 1. Scenario A — Stripe de-platforms SettleGrid

**Note.** Under Pattern A+, the original "Polar terminates SettleGrid's MoR account" scenario no longer applies (no Polar rail ships). The replacement concern is Stripe's own risk team de-platforming SettleGrid. Mitigation philosophy carries over: a pre-arranged backup MoR is the insurance.

**Trigger signals**
- Stripe risk email citing Restricted Businesses or Connect Platform Agreement breach
- Platform dashboard flags account reviews, payouts paused, funds held
- Sudden uncommunicated settlement delay beyond Stripe's published schedule
- Chargeback rate crossing 0.4% on the platform aggregate

**Impact**
- SettleGrid cannot onboard new Stripe Connect developers
- Existing payouts may be held; Stripe may claim platform reserve
- Every active Builder/Scale subscription charge is at risk

**First 4 hours**
1. Do NOT initiate withdrawals from the platform dashboard (this looks like flight-risk behavior and worsens the review)
2. Compose a transparent, numbered response to Stripe risk — facts, documentation links, commitment to any additional controls they request. Response within 4 hours even if full info isn't ready; follow-up is expected.
3. Notify counsel (§6 contacts)
4. If de-platforming is pending rather than confirmed: freeze new developer onboarding, freeze new consumer subscriptions. Do NOT pause existing subscriptions — canceling an active subscription as a defensive move creates chargeback risk on the consumer side.

**Days 1–7**
1. Execute the backup-MoR activation SOP (`docs/legal/backup-mor-sop.md` — *to be created; activated if Stripe exposure forces it*). Pre-arranged options: Paddle, Lemon Squeezy. Goal: a functioning alternate checkout within 48 hours.
2. Migrate consumers to the backup MoR at renewal (not retroactively — retroactive migration is messy and reopens chargeback windows)
3. If Stripe confirms termination: coordinate orderly payout of developer balances via Stripe's platform-dissolution flow. DO NOT send the "Stripe is gone" email to developers until Stripe confirms; until then it's "Stripe has paused us and we're working through it"
4. Counsel prepares a regulatory filing to the extent the termination becomes public-filing-material

**Resolution criteria**
- Reinstated: back to normal operations + post-mortem in `docs/legal/incidents/`
- Terminated: migration complete, all developer balances paid, counsel-drafted exit statement published

---

## 2. Scenario B — Stripe forces manual review

**Trigger signals**
- Unusual volume spike (intentional or not)
- Chargeback spike
- Stripe risk-team email requesting documentation
- Platform dashboard shows "under review" banner

**Impact**
- Platform balance held
- Payouts paused
- New Connect account creation may be paused

**First 4 hours**
1. Acknowledge receipt of Stripe's notice within 1 hour
2. Assemble the documentation package: developer ToS, AUP, OFAC program, current chargeback rate, volume trend chart, sample of recent successful charges. Make this ready-to-send BEFORE launch (don't assemble it during an incident)
3. Propose additional controls proactively: tighter rolling reserve, velocity caps on new developers, managed-risk opt-in for high-volume accounts
4. Do NOT contact Stripe via public channels (Twitter, forums). This escalates rather than resolves.

**Days 1–7**
1. Send the complete documentation package — ideally within 24 hours
2. Counsel is optional at this stage but on-call; engage immediately if Stripe hints at Connect Platform Agreement breach
3. Daily polite follow-up (not daily nag) if Stripe goes silent
4. Review signs of actual problem: are chargebacks clustered on one developer? Is a specific tool responsible? Use this scenario as a forcing function to surface and terminate the bad actor BEFORE Stripe does

**Resolution criteria**
- Review closed: volume returns to normal, payouts resume, any required controls stay in place
- Upgraded to Scenario A if Stripe signals termination

---

## 3. Scenario C — Florida or New Jersey enforcement action

**Trigger signals**
- Cease-and-desist letter from Florida Office of Financial Regulation or New Jersey Department of Banking and Insurance
- Subpoena or investigative inquiry from either state's AG
- Consumer complaint filed with either state alleging unlicensed money transmission by SettleGrid

**Impact**
- Potential forced cessation of operations in the affected state
- Reputational damage
- Possible civil penalty
- Reveal risk — enforcement can propagate to adjacent states

**First 24 hours**
1. **Do not respond directly.** Every communication goes through counsel. A founder-drafted response creates admissions that counsel cannot retract.
2. Counsel engaged — even if it means paying for immediate availability. The compliance-posture.md analysis notes FL + NJ as the primary state MTL exposure; counsel has likely already briefed this class of inquiry.
3. **Do not pause FL/NJ operations preemptively** without counsel's advice — pausing can be framed as admitting jurisdictional applicability. Counsel decides.
4. Assemble the factual record: SettleGrid's agent-of-payee analysis, developer ToS §[PASS-THROUGH], transaction volume in the state, any prior inquiry

**Days 1–30**
1. Counsel-drafted response — typically a factual statement of SettleGrid's model + the legal basis for the agent-of-payee position
2. If the state requires additional factual showing: provide counsel-reviewed transaction samples + compliance documentation. Do NOT provide raw data dumps without counsel review.
3. If enforcement demands registration: counsel evaluates whether to register (costly, slow, invites other states to do the same) or to exit the state (geographic block, honoring existing subscriptions to end-of-term)
4. File a change-log entry in `docs/legal/incidents/` and update `private/master-plan/compliance-posture.md` with the enforcement outcome

**Resolution criteria**
- No action filed: close incident, capture lessons, re-run counsel review if the state's theory is novel
- Registration required: operationalize per counsel's guidance
- Exit state: geographic block in onboarding, existing subscriptions honored to end-of-term, do not renew

---

## 4. Scenario D — OFAC violation

**Trigger signals**
- Monthly re-screening hit against the SDN list
- Manual review opened from an onboarding match
- Third-party report of a sanctioned party using SettleGrid
- OFAC inquiry arriving via counsel or directly

**Impact**
- Civil penalty up to the IEEPA-adjusted maximum (or twice the transaction value, whichever is greater) per 50 USC § 1705 and OFAC's annual inflation-adjustment at https://ofac.treasury.gov/civil-penalties
- Reputational harm that scales with the sanctioned party's notoriety
- Stripe likely issues its own de-platforming review (see §1)

**First 4 hours**
1. **Pause the developer's account immediately.** Do not wait for counsel for this step — it stops the bleeding on ongoing violations
2. Do NOT email the developer yet. Any premature email becomes evidence.
3. Notify counsel. OFAC response requires counsel-drafted everything.
4. Preserve the record: full screening-hit details, transaction history, developer signup data, OFAC screening audit trail from `docs/legal/ofac-program.md` §4.5

**First 5 business days**
1. Counsel reviews the facts + advises on voluntary self-disclosure. SettleGrid's default posture (per OFAC program §6) is to self-disclose unless counsel identifies a specific reason not to. Voluntary disclosure reduces civil penalties by up to 50%.
2. Counsel submits the voluntary disclosure package via https://ofac.treasury.gov/disclosure
3. Counsel separately notifies Stripe's risk team proactively — getting ahead of Stripe's own screening hit preserves the relationship
4. Internal controls review: what did SettleGrid's OFAC program fail to catch, and what patch is shipping? Document the patch.

**Days 5–90+**
1. Respond to any OFAC follow-up within counsel's advised window
2. Remediate the identified controls gap — e.g., if monthly re-screening missed a day, the cron monitoring gets a high-priority fix; if the onboarding check used a stale SDN list, the pull-cadence changes
3. If penalty issued: counsel negotiates via OFAC's settlement process
4. Publish (with counsel approval) a brief post-mortem to developers if the incident is public record, even if the specific developer isn't named

**Resolution criteria**
- OFAC closes with no action: extremely rare outcome, file + archive
- Penalty assessed: paid per OFAC settlement, controls patched, compliance program updated, annual audit flags the event for extra scrutiny for three years

---

## 5. Scenario E — Chargeback cascade

**Trigger signals**
- Chargeback velocity alert crossing 0.5% platform-wide (pre-wired monitoring)
- One developer's chargeback rate exceeding 1% within a 7-day window
- Stripe Managed Risk flags a specific account
- Sudden spike in consumer refund requests

**Impact**
- Stripe debits SettleGrid's platform reserve for the chargebacks
- If a single developer is the source and has no balance to cover: SettleGrid eats the debit (this is the Express-vs-Standard platform-liability exposure)
- Potential rolling-reserve increase on the platform

**First 4 hours**
1. Identify the source: one developer or spread across many?
2. If a single developer: suspend their account (AUP §5.2 Hold), freeze any outgoing payouts
3. Pull the raw chargeback reasons — "fraud" vs "product not received" vs "not as described" have different remediations
4. Notify Stripe risk proactively, not reactively — getting ahead of Stripe's own detection preserves the relationship

**Days 1–14**
1. For fraud chargebacks on a single developer: treat as account compromise or outright fraud. Terminate (AUP §5.2 Termination) under 2.1 unlawful-activity. Attempt recovery of the terminated balance against Stripe's platform reserve.
2. For product-quality chargebacks: engage the developer, offer refund-resolution path to affected consumers BEFORE they dispute. Refund-resolution costs SettleGrid the refund; a chargeback costs SettleGrid the refund + the chargeback fee + reputational hit with Stripe.
3. Activate rolling reserves on the implicated developer's payouts (and any newly-onboarded developers in the same category) — typically 10–20% hold with 30-day release
4. If platform-wide rate stays elevated: counsel review + consider short-term freeze on new developer onboarding in the implicated category

**Resolution criteria**
- Single developer resolved: terminated or remediated; chargeback rate returns to baseline within 30 days
- Platform-wide: rolling reserves become permanent; AUP updated with the newly-identified risky category

---

## 6. Unclassified incidents

Add any incident that doesn't match §1–§5 to the incidents folder with the prefix `UNCLASSIFIED-`. On the next playbook review, evaluate whether to promote it to a named scenario.

---

## 7. Contacts + resources

- **Compliance officer:** compliance@settlegrid.ai (founder inbox, 24h SLA on sanctions + CSAM; same-day SLA otherwise)
- **Counsel of record:** *TBD — lawyer engagement retained for Phase 2 will cover all incident scenarios*
- **Stripe risk team:** via platform dashboard Support → Risk category
- **OFAC disclosure submission:** https://ofac.treasury.gov/disclosure
- **OFAC Compliance Hotline:** 1-800-540-6322
- **FL OFR:** https://flofr.gov (for Scenario C)
- **NJ DOBI:** https://www.nj.gov/dobi (for Scenario C)
- **Incident log directory:** `docs/legal/incidents/`

---

## Change log

| Date | Version | Change |
|---|---|---|
| 2026-04-18 | 1.0 | Initial playbook drafted under P2.COMP1. Five scenarios cover the failure modes identified in compliance-posture.md §"Failure mode scenarios". Scenario A updated for Pattern A+ (was Polar; now Stripe de-platforming with backup-MoR pre-arrangement). |
