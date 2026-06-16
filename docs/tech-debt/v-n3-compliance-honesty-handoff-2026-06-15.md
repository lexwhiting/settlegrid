# V-N3 (compliance-honesty slice) — correct the LIVE DC-16 false "PII scrubbed" GDPR-deletion claim — ① BUILDABLE HANDOFF (2026-06-15)

> Standalone handoff for the FRESH build session. Read this FIRST, before any code. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). Build base =
> `main` @ `fa87333a` (V-N2b sealed + pushed). Source-of-truth register:
> `docs/tech-debt/s-deep-audit-register-2026-06-10.md` (V-N3 = the next priority item). The full
> V-N3 record: `docs/tech-debt/v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md` (READ §2 + §5).
> This is the **narrow, non-legal-gated SLICE** of V-N3, founder-selected. **This handoff already
> folds the ① pre-build plan audit's findings (2 CRITICAL + refinements) — build from it as written.**

---

## 0. Decision, tier, intent

- **Chunk:** Make the **GDPR Article-17 data-deletion claim HONEST across every surface that asserts
  it**, closing a LIVE DC-16 false-compliance claim. Today multiple surfaces tell a developer their
  data-deletion scrubbed financial-record PII, but `ledger_entries` persists the anonymous on-chain
  PAYER's raw EVM address (in `operation_id` + `metadata.payer`) **un-scrubbed** (the deletion txn
  never touches it). Correct the claims to be truthful; **never assert a lawful basis ("exempt").**
- **Tier: HIGH-STAKES.** Triggers: **affects PUBLISHED + recorded claims** (a public docs FAQ AND a
  developer-downloadable GDPR-deletion result) **+ a PII/compliance boundary** (DC-16). Low
  code-complexity; the legal/trust surface + the DC-16 false-claim risk make it HIGH-STAKES. Audit
  judgment concentrates on WORDING-SAFETY, COMPLETENESS-of-surfaces, and NOT pulling in legal-gated work.
- **Intent (WHY / who consumes / what it enables):** A developer exercising GDPR erasure reads (public
  docs FAQ) and is RECORDED (the deletion `resultUrl`, which is developer-downloadable — confirmed via
  `GET /api/dashboard/developer/data-export/[id]`) that financial-record PII was scrubbed. For
  `ledger_entries` that is FALSE — the anonymous buyer's EVM address survives. A false "we scrubbed your
  PII" GDPR statement is a real compliance/trust liability. This chunk makes every such claim truthful
  (states the gap; never claims "exempt"), closing the live DC-16 surface — WITHOUT building the actual
  erasure (legal-gated, V-N3-erasure). It is the honest-bookkeeping precondition the erasure chunk builds on.

## 1. Scope — exactly what to build (and what NOT to)

**SURFACE CENSUS (corrected by the plan audit — the pre-flight's "exactly 2" was WRONG; a `.tsx`/synonym
grep found the public FAQ). The claim lives on THREE files / FOUR+ spots:**
| # | File:loc | Current claim | Severity |
|---|---|---|---|
| A | `apps/web/src/lib/settlement/compliance.ts:353` | docstring "Anonymizes PII across all relevant tables" | MED (same false flavor as B) |
| B | `compliance.ts:354-355` | docstring "Financial records (…ledger_entries…) … PII is scrubbed" | **HIGH — the clearest false claim (explicitly names ledger_entries)** |
| C | `compliance.ts:528-545` | the `resultUrl` JSON `retained:[…'ledger_entries'…]` (developer-downloadable) | HIGH (recorded + reachable) |
| D | `apps/web/src/app/docs/page.tsx:615` | PUBLIC FAQ "anonymize your PII **across all tables**" | MED (over-claim; "your PII"=developer's is scrubbed, but "across all tables" implies a comprehensive scrub) |

**BUILD:**
1. **A + B (the docstring `:351-366`):** rewrite so it stops asserting `ledger_entries` PII is scrubbed
   and stops the "all relevant tables" over-claim. State honestly: the four financial tables are RETAINED
   for 7-yr IRS/Stripe bookkeeping; the developer's OWN identifying PII is scrubbed at its SOURCE (the
   `developers` row is anonymized in step 1 — VERIFIED true, `:428-445`), so these records reference only
   an anonymized account; **but** `ledger_entries` ALSO persists the anonymous on-chain PAYER's raw EVM
   address (`operation_id` + `metadata.payer`) which this deletion does NOT scrub — lawful-basis/erasure
   unsettled, routed to V-N3-erasure (counsel pending).
2. **C (the `resultUrl` JSON `:528-545`):** the developer-downloadable per-deletion record must ALSO be
   honest. Add an explicit honest disclosure that `ledger_entries`'s payer address is RETAINED UN-SCRUBBED.
   Suggested: a `retainedUnscrubbed: ['ledger_entries.operation_id', 'ledger_entries.metadata.payer']` key
   (column-PATH NAMES only — NEVER row values; verified the JSON carries only names today). Keep `retained`
   accurate. **Do NOT name the field `anonymized` or fold it into `retained`** (re-implies a scrub).
3. **D (the public FAQ `docs/page.tsx:615`):** soften the "across all tables" over-claim so it no longer
   implies a comprehensive cross-table scrub — e.g., scope it to the developer's PII fields (emails/names/
   IPs) "wherever they appear" and acknowledge retained financial records (consistent with the more-careful
   adjacent FAQ at `:635`). ⚠ PUBLIC-FACING copy — keep it factual, no new legal claim; flag for founder/②
   eyeball.
4. **Regression test** — see §5 (MANDATED strategy; the plan audit found the naive approaches vacuous/
   un-runnable).

**Re-run the synonym-inclusive census in the build** before declaring done:
`git grep -niE 'anonymiz|scrub|erasure|right to erasure|pii.*(delet|remov)|across all tables' -- 'apps/web/src/**/*.ts' 'apps/web/src/**/*.tsx'` and consciously decide EACH hit (the audit judged `:635`/`:607`/`:639`
defensible/leave — `:635` omits ledger_entries and is developer-scoped; confirm none newly contradicts the
corrected claim).

**DO NOT build (reject scope creep — legal-gated / separate):**
- The ACTUAL erasure/scrubbing/tombstoning of the payer address; any `delete(ledgerEntries)` / `operation_id`
  anonymization — the legal-gated **V-N3-erasure** chunk (lawful basis + retention + dedup-key redesign need
  founder + counsel; V-N3 record §5).
- Any edit to `docs/legal/privacy-notice-draft.md` (legal-gated; published only after founder+counsel —
  V-N3 record §5.5). The notice is an ABSENCE (never contemplates the payer), NOT a false claim → OUT.
- The compliance EXPORT path (`collectDeveloperData`) ledger_entries omission — an absence entangled with the
  payer-vs-developer data-subject distinction (legal-gated). Do NOT add ledger_entries to the export.
- Re-framing payouts/purchases/settlement_batches as leaking PII — VERIFIED CLEAN by the audit (only
  `ledger_entries` carries an inline raw third-party EVM address; the other three reference the developer by
  UUID, scrubbed at source). Do NOT over-correct.
- The `data-export/[id]` route serving any completed `resultUrl` regardless of `requestType` (a minor
  access-control note the audit raised) — OUT of this chunk; note for a follow-up if desired.

## 2. ⚠ THE LOAD-BEARING DECISIONS (where audit judgment concentrates — most likely to be silently wrong)

**Decision A — the corrected WORDING's legal posture (DC-16 trap).** State the gap as FACT (retained,
un-scrubbed, erasure pending) — NEVER a lawful CONCLUSION. The trap: "fixing" by writing "retained under the
financial-records exemption" / "the payer address is exempt" — a NEW DC-16 false claim, because the V-N3
record §3 establishes the account-holder financial-retention exemption does NOT cover the anonymous payer
(unsettled counsel question). Also: do NOT over-correct the other 3 financial tables, and do NOT escalate the
developer-PII claim to "unidentifiable"/"all linkage removed" (the email becomes a deterministic
`deleted-<id>@…` and the `developerId` UUID still joins rows — say "anonymized," not "erased/unlinkable").

**Decision B — COMPLETENESS + machine/human/public consistency.** FOUR surfaces (A,B,C,D) assert this claim;
fixing one while another still implies the scrub leaves the chunk's purpose half-done — and surface D is the
MOST-read (public docs). All must be honest and mutually consistent. The `resultUrl` (C) is developer-
DOWNLOADABLE (confirmed), so it is load-bearing, not internal-only.

## 3. Frozen / existing surfaces + mechanical facts (pre-flight, already run — do not re-derive, but DO re-run the §1 census)

- **Claim surfaces:** A,B,C in `compliance.ts` + D in `docs/page.tsx` (table above). The pre-flight's
  `git grep -i scrubbed -- '*.ts'` found only B; the audit's `.tsx`+synonym grep found D — hence the
  MANDATED re-census in §1.
- **No existing test pins** the deletion claim (verified: `compliance.test.ts` + `settlement-moat.test.ts`
  deletion tests assert status/behavior, none pin `retained`/`anonymized`/the docstring). Changing A–D breaks
  NO test; you ADD a new pin.
- **`processDataDeletion`** (`compliance.ts:367-560`): returns `{ status }` ONLY; the `resultUrl` JSON is
  WRITTEN into the `complianceExports` row (`:526-528`, `tx.update(...).set({resultUrl: JSON.stringify(...)})`),
  NOT returned. The deletion txn (steps 1–8) anonymizes developer/consumer/api-key/invocation-metadata/
  audit-log/webhook/review/tool rows; it **never touches** payouts/purchases/ledger_entries/settlement_batches.
- **The un-scrubbed PII** is `ledger_entries.operation_id` (`{rail}:{network}:{payer}:{nonce}`) +
  `metadata.payer` (`authorization.from`). Writers `x402/orchestrate.ts:104-106,159`, `circle-nano/settle.ts`
  — **read-only context, do NOT touch.**
- **Gate baseline @ `fa87333a`:** `cd apps/web && npx tsc --noEmit && npm run lint && npm test` → tsc 0 ·
  lint 0 err (pre-existing warns only) · vitest **194 files / 4491 / 0**. `packages/mcp` untouched
  (build 0 · 1898/1 skip · lint 0). Re-run the FULL gate after the change; vitest should be 4491 + your new
  test(s). (You touch only `apps/web`; mcp need not be re-run beyond confirming it's untouched.)

## 4. Lifecycle + defect classes

- **Lifecycle:** scope-confirm → draft plan → **pre-build plan audit (DONE this ① session — folded above)** →
  build → executable gate → ② seal-gating review → seal + bookkeeping. Founder-close (LOCAL commit; push only
  on explicit founder say-so).
- **Defect classes** (`.audit/defect-ledger/INDEX.md`): **DC-16** (public/recorded-claim integrity — the
  core; remove the false claim WITHOUT adding a new one). Touch points: DC-15 (keep the corrected comment in
  sync with code), DC-05 (the new regression test must be non-vacuous).

## 5. Tests — MANDATED strategy (the plan audit found the alternatives vacuous or un-runnable)

Add a NEW standalone file **`apps/web/src/lib/__tests__/compliance-honesty-regression.test.ts`** mirroring
`apps/web/src/__tests__/privacy-notice-regression.test.ts` (which pins corrected compliance claims). Use the
**SOURCE-TEXT `readFileSync` + regex** strategy — do NOT try to run `processDataDeletion` (it returns only
`{status}`; the `resultUrl` is persisted-not-returned, and the existing `compliance.test.ts` mock lacks
`transaction`/`delete`/`inArray`/most schema tables, so running it is a large harness lift for no benefit; a
docstring is a comment and is ONLY assertable as source text). Read `compliance.ts` AND `docs/page.tsx` as
text (mind the relative depth from `src/lib/__tests__/`) and assert:
- **Honest disclosure PRESENT:** the `compliance.ts` source contains the `ledger_entries` payer-address gap
  disclosure (`operation_id` + `metadata.payer` retained un-scrubbed) in BOTH the docstring region AND the
  `resultUrl` region; `docs/page.tsx:615` no longer claims "across all tables".
- **False claim ABSENT:** no surface asserts the payer/ledger_entries PII is "scrubbed"; and NONE contains
  `exempt`/`exemption`/`financial[- ]retention exemption`/`lawful basis (for|to) retain` (reject synonyms,
  not just the bare token "exempt").
- **Non-vacuity, PER SURFACE:** reverting the docstring edit alone → RED; reverting the resultUrl edit alone →
  RED; reverting the docs-FAQ edit alone → RED (anchor each assertion to its own region so none is vacuous).
- ⚠ **CAUTION:** `compliance.ts:489` contains the comment `Scrub IP/UA from audit logs` — a naive
  `not.toMatch(/scrub/i)` over the whole file FALSE-REDs. Scope each regex to its target region / the
  specific false phrasing, not a blanket file-wide "scrub" ban.
- The field name chosen in §1.2 and the test regex must be authored together (coupling).
