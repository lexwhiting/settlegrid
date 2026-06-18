# V-N3 (compliance-honesty SLICE 5) — all-rows consumer-twin erasure — ③ POST-SEAL DEEP AUDIT → SEAL STANDS (2026-06-18)

> ③ integrated-whole post-seal deep audit of the SEALED SLICE-5 build (`processDataDeletion`,
> `apps/web/src/lib/settlement/compliance.ts`, shasum `15df048ea7589ddeae3ecf7e6b23c04acc5937ff`).
> Predecessors: build handoff `…-slice5-allrows-twin-erasure-handoff-2026-06-18.md`; seal record
> `…-slice5-seal-2026-06-18.md`; ③ handoff `…-slice5-post-seal-deep-audit-handoff-2026-06-18.md`.
> DC-16 ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.
> Tier confirmed **HIGH-STAKES** (PII/financial erasure boundary; single-row→set-based identity resolution,
> changed auth-delete set + disclosure gating, a new UNIQUE(email) vector ruled unreachable) → ③ warranted.

## VERDICT: SEAL STANDS — certified as-shipped, no fix required, no frozen surface perturbed.
Zero sustained high- or medium-severity findings. The shipped SLICE-5 set-based consumer-twin erasure is
correct, atomic, idempotent, disclosure-honest, and PII-complete for its (developer-linked-twin) scope. No
false claim in the persisted erasure-proof artifact (`resultUrl`).

## Audit shape (distinct from the diff-scoped ② seal review — this targets the INTEGRATED WHOLE)
- **Orchestration:** operator opted into a **workflow** (`wf_9f7d1790-bf6`); 6 fresh-context lens-distinct
  reviewers at the `xhigh` baseline → adversarial verification of every sustained high/med finding →
  collective-miss critic (at `xhigh`; the optional `max` bump was not taken — no-stall default). 9 agents,
  258 tool-uses. All reviewers + the critic self-reported `claude-opus-4-8[1m]` (effort self-report
  known-unreliable; assurance rests on convergence + ground-truth, not the label). The decisive DC-16 +
  consumer-PII census + the verdict were held in the main session (integrator), independent of the fan-out.
- **Mechanical pre-flight (clean isolated, this session):** `tsc --noEmit` 0 · `npm run lint` 0 err (8
  pre-existing `<img>`/unused-disable warns) · `npx vitest run` **4572/197/0** (matches the sealed baseline;
  no flake this run). `compliance.ts` shasum unchanged (`15df048e…`).
- **Lenses:** L1 correctness/atomicity/determinism/idempotency · L2 DC-16 claim-honesty census + DC-11 +
  DC-15 · L3 SEAM · L4 literal-execution · L5 consumer-keyed-PII census · L6 test-fidelity/integration-gap/
  flake. + the collective-miss critic.

## Integrator ground-truth (re-derived live, in-session — the decisive layer)
- **Consumer-keyed-PII census EXHAUSTIVE under the set model.** The 9 FKs → `consumers.id`:
  `apiKeys`(246), `auditLogs`(508, SET NULL), `toolReviews`(547), `conversionEvents`(615),
  `consumerSchedules`(1268) are SCRUBBED (+ the `consumers` per-row anonymize) = the 6 consumer-keyed write
  surfaces; the 4 frozen — `consumerToolBalances`(204), `invocations`(324), `purchases`(375),
  `consumerAlerts`(647) — verified PII-free / financial-retained / attribution: `consumerToolBalances` &
  `purchases` carry only ids/cents/enums/Stripe refs (no free-form PII); `invocations.metadata` is the
  tool-owner's developer-defined namespace (`referralCode`/`sessionId` are commission attribution);
  `consumerAlerts.channel` is an enum (`email`/`webhook`), not an address.
- **DC-16 manifest HONEST.** Every `anonymized` entry's disclosure gate matches its actual scrub; the
  **unconditional `audit_logs.details` claim is airtight** — `audit_logs.consumerId` is a nullable FK to
  `consumers.id` (`audit.ts` sets it only in a consumer-context write), so a consumerId-keyed row carrying
  the subject's PII exists only when the subject has a consumer account → `consumerMatched` → step 5b fires
  over the full set; a no-twin developer has no such rows. DC-11 paths-only holds (the per-row
  `deleted-<id>@…` value never reaches the manifest).
- **H1 UNIQUE(email) collision UNREACHABLE.** Distinct uuid PKs ⇒ distinct per-row `deleted-<id>@…`; the
  only 4 organic `db.insert(consumers)` sites (auth/callback, ask/capture, consumer/academic,
  newsletter/subscribe) write no `deleted-…@deleted.settlegrid.ai` literal.
- **No DB side-effects.** No triggers / materialized views / generated columns / `consumers.email` FK
  anywhere → the per-row anonymize loop fires no cascade (consumers are anonymized, not deleted).
- **Live product-claim surfaces** (docs FAQ, privacy, settings) are consistent with — and made *more* true
  by — the set-based model; the set change strictly increases completeness, so no claim is over/understated
  by SLICE-5.

## Full finding adjudication (13 findings + 4 collective-misses; NONE sustained as a shipped defect)
**Adversarially refuted (the only two mediums):**
- **DEL-CENSUS-01** (was MED) — `invocations.metadata` "over-claim": REFUTED → none. The disclosure is gated
  identically to its scrub (`toolIds.length>0`), honest under the DC-11 "PROCESSED, not row-count" contract;
  the consumerId-vs-toolId keying split was consciously ruled + TESTED in the seal
  (`compliance-deletion-auth.test.ts:739`). The genuine residual (a consumer twin's PII inside FOREIGN
  developers' invocation metadata) is the pre-existing, deferred deletion-COMPLETENESS class — not a SLICE-5
  defect, not a false claim. **Ledger-precision correction:** the SLICE-4-③ census label "invocations =
  (no-action)" is imprecise → it is **scrubbed (developer-tool-keyed, step 4) + disclosed
  (`toolIds.length>0`)**; the foreign-tool consumer rows are the deferred-completeness item.
- **GAP-1** (was MED) — no real-SQL harness: REFUTED → LOW = the already-accepted **T-f construction-pin
  gap**. The three behaviors (two-row resolution, per-row UNIQUE-collision avoidance, multi-auth-delete) are
  correct-by-construction; this is a test-methodology gap on a dormant function, not a code defect.

**LOW / INFO — all pre-existing / frozen-surface / dormant-future-caller / accepted-residual-class; none
introduced or worsened by SLICE-5, none a shipped defect, none requiring a `compliance.ts` change under seal:**
- **SEAM-1** (LOW) — `requestDataDeletion` accepts `entityType:'customer'` but the processor is
  developer-only → a customer-typed request lands `'failed'`. Pre-existing, dormant, frozen; → deletion-route
  wiring tech-debt.
- **LE-1** (LOW) — step-2b waitlist DELETE recomputes `lower(trim(dev.email))` inline WITHOUT the F-4 guard
  → `lower(email)=''` on an empty dev email. Harm **UNREACHABLE** (sole waitlist writer validates
  `z.string().email()` → no empty-email row), atomic (in-txn), pre-existing (SLICE-3), **frozen surface**
  (handoff §3). A real F-4-class recurrence at an unguarded sibling site, but no reproducing harm → record,
  do NOT perturb step-2b under this seal; bundle the one-line `if (norm !== '')` guard with the active-caller
  hardening pass.
- **LE-2 / LE-3** (INFO) — JS `.trim()`/`.toLowerCase()` vs Postgres `trim()`/`lower()` Unicode/collation
  divergence: the same accepted "internal-space/NBSP/exotic-Unicode twin escapes" residual; comment-precision
  nit. No action.
- **FLAKE-1** (LOW) — confirms the seal's diagnosis: the erasure path has ZERO shared state; the auth-rig's
  module-level `vi.hoisted` arrays are **LATENT** (tests run sequentially per file + reset per-test), not the
  active cause (worker-pool/import timing). **ACCEPT as known-intermittent; do NOT churn the rig under seal.**
  Guard note: IF a future edit marks these describes `.concurrent`, move to file-local/per-test state then.
- **PIN-1…5** (INFO) — all SLICE-5 test pins confirmed REAL/non-vacuous (corroborates the seal's L4
  mutation-to-RED).

**Collective-miss critic (4, all LOW/INFO, all adjacent-chunk dormant/future-caller — none falsifies the seal):**
- MISS-1 (LOW) — `docs/page.tsx` GDPR FAQ UNDER-discloses retained data (omits `ledger_entries` on-chain
  payer EVM address + `organizations.billing_email` that the function's own `retainedUnscrubbed` admits).
  Directional risk = *opposite* of over-claiming. Pre-existing docs → docs-honesty reconciliation, dormancy-gated.
- MISS-2 (LOW) — docs + the `accountDeletedEmail` template promise a confirmation email the function never
  sends (it correctly does no email, matching `processDataExport`'s route-sends-email separation); 0 prod
  callers. Dormant-wiring gap → precondition on the deletion-route.
- MISS-3 (INFO) — the live `data-export/[id]` download route is requestType-agnostic → a future completed
  deletion record's raw-JSON `resultUrl` would hit the non-data-URL redirect branch. Unreachable now → route guard.
- MISS-4 (INFO) — `processDataDeletion` never validates `record.entityType` (confirms/extends SEAM-1).

## DORMANCY-END / deletion-route wiring tech-debt cluster (track together; NOT in SLICE-5 scope)
When the first production caller of `processDataDeletion` is wired, address as a bundle (the handoff already
notes authz/IDOR/mass-delete hardening becomes blocking then):
1. **entityType handling** (SEAM-1 / MISS-4): guard `entityType !== 'provider'` with a clear error, or
   implement a dedicated consumer-subject erasure path.
2. **download/status route** (MISS-3): add a `requestType` guard to `data-export/[id]/route.ts`, or store the
   deletion `resultUrl` in the data-URL envelope the route expects.
3. **accountDeletedEmail** (MISS-2): fire it from the route BEFORE the auth/email becomes unrecoverable
   (mirror `data-export/route.ts:96`).
4. **docs FAQ retention reconciliation** (MISS-1): align `docs/page.tsx` retention copy with the function's
   `retained` + `retainedUnscrubbed` manifest.
5. **real-Postgres integration test** (GAP-1 / T-f): add `@electric-sql/pglite` (devDep) + one integration
   test seeding two case-variant consumer rows → assert both anonymized to distinct `deleted-<id>@…`, no
   UNIQUE violation, both `supabaseUserId`s deleted.
6. **step-2b waitlist F-4 guard** (LE-1): `if (norm !== '')` + bind `${norm}`.

## Accepted residuals carried (unchanged, NOT worsened — ruled, not silently dropped)
- T-f construction-pin gap (→ cluster #5). Rig flake (accept; → cluster note). DC-14 stale `drizzle/meta`
  snapshot (F-A, runtime executes `schema.ts`-derived DDL — unaffected). `audit_logs.consumerId`
  `onDelete:'set null'` concurrent-sibling-hard-delete window; row-inserted-after-capture; internal-space/
  NBSP/exotic-Unicode twin escapes (LE-2/LE-3 class). `ledger_entries` on-chain payer EVM (→ V-N3-erasure).
  No locking/serializable added (dormant path).

## Defect-class ledger
**No NEW defect class.** SEAM recurrences (SEAM-1 cross-function entityType seam; LE-1 F-4-guard class at an
unguarded sibling) are pre-existing + dormant/unreachable → tracked as travel, not opened under seal.
LITERAL-EXECUTION: no imperative-without-a-tool / mis-render. DC-16: the manifest is honest; the
"invocations = (no-action)" census label corrected to "scrubbed developer-tool-keyed + disclosed". DC-16
ledger appended.

## Lifecycle / next
Founder-close = a single path-scoped LOCAL commit (`compliance.ts` + `compliance-deletion-auth.test.ts` +
`settlement-moat.test.ts` + the slice-5 docs; **EXCLUDE `tools/page.tsx`**), bundled after ③, commit message
records **③ SEAL STANDS**. `/push-go` is a separate explicit push gate.
