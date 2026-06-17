# V-N3 compliance-honesty SLICE 3 — ② SEAL BLOCKED → RECOVERY build handoff (2026-06-17)

> Standalone handoff for the FRESH **recovery build** session. READ THIS FIRST. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**).
> **The ② seal-gating review of SLICE 3 found two sustained HIGH defects → BLOCKED.** This handoff
> is the recovery brief: it carries the blocking findings, the precise fix specs, the census the
> F-1 fix REQUIRES, the travel/watch items, and the rulings already discharged so they are NOT
> re-litigated. The original ① build handoff is the predecessor:
> `docs/tech-debt/v-n3-compliance-honesty-slice3-handoff-2026-06-16.md` (§7 fold). DC-16 ledger:
> `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.

---

## 0. Status, base, tier

- **② verdict: BLOCKED** (not sealed). Gate was GREEN (tsc 0 · lint 0 err · vitest **4542/197/0** =
  baseline 4525 + 17 new, reconciled; re-run clean by the integrator), and the BUILT diff is
  internally correct, atomic, idempotent, and **non-vacuously tested** (5-lens fresh-context max
  fan-out: spec-conformance CONFORMS, correctness CLEAN, SEAM no-false-premise, literal-execution
  tests-non-vacuous, core-invariant over-scrub/integrity/moat SOUND). It is blocked **only** by two
  sustained HIGH completeness/disclosure findings (F-1, F-2 below). The chunk's own purpose
  (close the deletion-completeness gap with HONEST disclosure) is not yet met.
- **Build base = the CURRENT working tree, NOT a fresh checkout.** SLICE 3's 4-file diff is CORRECT
  and is **KEPT** — the F-1/F-2 fixes are **ADDITIVE on top of it**. It is **uncommitted** (local,
  unstaged) on `main` @ `c3b78fce`. Do NOT revert or re-do the existing 4 scrubs
  (`notification_webhooks`, the normalized waitlist DELETE, `audit_logs.details` on the subject's
  own rows, the tool infra trio) or the disclosure/test work — those passed review. ADD to them.
- **Tier: HIGH-STAKES** (unchanged — PII/erasure boundary; atomic anonymization txn; published
  compliance disclosure). ② re-confirmed; not escalated, not lowered.
- **Dormancy (mitigant, not an excuse):** `processDataDeletion` still has NO HTTP route caller in
  prod (SLICE-2 ③ confirmed), so F-1's false disclosure is not EMITTED to a user today. The cadence
  standard is "correct now" → it still blocks. No production fire; fix with normal build rigor.

## 1. THE TWO BLOCKING FINDINGS (must both be closed before re-entering ②)

### F-1 — HIGH — the unconditional `'audit_logs.details'` disclosure is a FALSE recorded claim (DC-16 recurrence)
- **What the built diff did:** step 5 now nulls `audit_logs.details` `WHERE eq(auditLogs.developerId,
  developerId)` and adds `'audit_logs.details'` to the `resultUrl.anonymized` array **UNCONDITIONALLY**
  (`compliance.ts` step 5 + step 9).
- **The defect (CONFIRMED at source + census, structurally airtight):** the subject's raw email lands
  in `audit_logs.details` on rows that are NOT keyed to the subject's `developerId`, which the
  `developerId`-scoped scrub provably cannot reach — so the unconditional "audit_logs.details was
  anonymized" claim is FALSE for those subjects. Confirmed leak:
  - `apps/web/src/app/api/admin/chargeback-watch/unpause/route.ts:145-154` writes
    `writeAuditLog({ developerId: auth.id /* the ADMIN */, resourceType:'developer',
    resourceId: target.id /* the subject */, details:{ targetDeveloperEmail: target.email /* the
    subject's raw email */, adminEmail, note } })`. When `target` later deletes, step 5 keys on
    `developerId = target.id` ≠ `auth.id` → this row is **never touched** → the subject's email
    SURVIVES, while the persisted disclosure claims it was scrubbed.
- **This is the THIRD "partial-fix-leaves-a-sibling" DC-16 recurrence in V-N3 compliance** (S2-81 OFAC
  §9 → SLICE-2 docs:635/639 → SLICE-3 audit_logs.details). §7-A closed the `auth/callback` login-email
  sibling and **missed the chargeback sibling** — the ledger's own detection cue ("grep ALL
  occurrences — a partial fix leaves a sibling") applies to the `audit_logs.details` primitive.

- **THE FIX REQUIRES A FULL `audit_logs` PII CENSUS — do NOT spot-patch the one chargeback row** (a
  one-row patch is how this class keeps recurring). The census must cover all three keying paths,
  because step 5 today scrubs `developerId` ONLY but `audit_logs` also has a `consumerId` column and
  `resourceId` linkages:
  1. **Enumerate every audit-log writer** (≈38 `writeAuditLog`/`insert(auditLogs)` call sites; start
     from `git grep -nE "writeAuditLog\(|insert\(auditLogs\)" apps/web/src`). For each, record what
     `developerId`/`consumerId` it is keyed to and whether `details` (or `resourceId`) can hold the
     **subject's** PII.
  2. **Triage (the integrator's partial census — VERIFY and COMPLETE it):**
     - `auth/callback/route.ts:198` → keyed to subject's own `developerId`, `details.email` = subject
       → **already caught** by the shipped step-5 scrub. ✓
     - `admin/chargeback-watch/unpause/route.ts:145` → keyed to **admin** `developerId`,
       `details.targetDeveloperEmail` = subject → **LEAKS** (the confirmed F-1). ✗
     - `admin/signup-followup/route.ts:230` → keyed to subject (`body.developerId`),
       `details.actor_email` = the admin's email (collateral, not subject) → caught; subject's row
       scrubbed. ✓
     - `admin/reviews/[id]/route.ts:114` → keyed to admin, `details` = `{action,reason,previousStatus}`
       (no subject email) → no subject-PII-in-details leak. ✓ (but confirm `resourceId`/reason can't
       embed PII).
     - **CONSUMER-KEYED ROWS — UNVERIFIED, MUST CENSUS:** if the subject has a consumer twin, audit
       rows written with `consumerId` (e.g. `consumer/keys`, `consumer/budget`) are scrubbed by step 5
       **not at all** (it keys on `developerId`). Determine whether any consumer audit writer puts the
       subject's PII in `details`; if so, they LEAK identically.
  3. **Choose the fix (build's call, via its own plan-audit) — make the unconditional claim TRUE with
     minimal collateral:**
     - **Option A (RECOMMENDED — SAFE-COMPLETE, matches §7-A's whole-column philosophy):** broaden the
       step-5 scrub to also null `details` on the subject-referencing rows — add the consumer-twin's
       rows (`WHERE consumerId = consumerRecord.id`, gated on `consumerRecord`) AND the cross-principal
       rows that reference the subject as the resource (`WHERE resourceType IN ('developer',
       'developer_signup', …) AND resourceId = developerId`). ⚠ TRADE-OFF: nulling the whole `details`
       on an admin's row also drops that row's `adminEmail`/`note` collateral — acceptable for GDPR
       erasure (the subject's PII must go; the admin's email is recoverable from `developerId=admin`),
       but RULE on it explicitly.
     - **Option B (surgical):** strip only the subject's PII key(s) from `details` on those rows (jsonb
       `details - 'targetDeveloperEmail'` / set to null), preserving admin collateral — more complex,
       and must enumerate every PII key shape.
     - **Option C (source-side):** stop writing the subject's raw email into the chargeback audit row
       (store only `resourceId`). ⚠ Touches a FROZEN admin surface (`chargeback-watch/unpause`) — only
       if the build's plan authorizes it; otherwise prefer A/B.
     - Whichever is chosen, the disclosure entry stays `'audit_logs.details'` UNCONDITIONAL **only if
       the fix makes it universally true**; otherwise gate/qualify it honestly. Do NOT ship an
       unconditional claim the scrub doesn't back.
  4. **Tests (DC-05 non-vacuous, DC-16):** the unit rig mocks the DB and **discards the `.update().where()`
     predicate** (both `compliance-deletion-auth.test.ts` and the moat rig), so today it cannot pin a
     WHERE clause. EXTEND a rig to capture the step-5 update predicate(s) (mirror the `deleteCalls`
     capture seam already added for the waitlist DELETE), then pin that the scrub reaches the
     consumer-twin / cross-principal rows (revert the broadened predicate → RED). If the chosen fix
     keys on `resourceId`/`consumerId`, assert those predicates are issued.

### F-2 — HIGH — `tool_reviews.developer_response` (subject-authored) survives, neither scrubbed nor disclosed
- **The defect (CONFIRMED at source):** `tool_reviews.developer_response` (`schema.ts:550`, `text`,
  "max 1000 chars") + `developer_responded_at` (`schema.ts:551`) hold free text the **data subject
  authored** (written via `apps/web/src/app/api/dashboard/developer/reviews/[id]/respond/route.ts:67`
  by the authenticated developer on reviews of THEIR OWN tools — keyed via `tools.developerId`). The
  shipped step 7 (`compliance.ts`) anonymizes only the consumer twin's `comment`
  (`WHERE eq(toolReviews.consumerId, consumerRecord.id)`) — it NEVER touches `developer_response`,
  which lives on rows keyed to the developer's TOOLS, not the consumer twin. So a `[Deleted]`
  developer's free-text replies (which can contain contact info) survive a `completed` deletion, and
  are in NEITHER disclosure array. Same class as the already-scrubbed `comment`/`publicBio`; **not** a
  §1/§7-H deferral → an in-purpose completeness MISS (the plan + the §7 plan-audit both missed it).
- **THE FIX:** inside the txn, gated on `toolIds.length > 0`, null both columns on the subject's
  tool reviews:
  `tx.update(toolReviews).set({ developerResponse: null, developerRespondedAt: null })
   .where(inArray(toolReviews.toolId, toolIds))`. (Distinct WHERE from step 7's consumer-`comment`
  scrub — this keys on `toolId ∈ toolIds`. Add as step 7b or fold near step 8; keep it INSIDE the
  txn for atomicity/idempotency.) Naturally idempotent (null-on-retry).
- **DISCLOSURE:** add `'tool_reviews.developer_response'` to the `anonymized` array, gated on
  `toolIds.length > 0` (mirror the existing tool-paths gating). Keep `comment` scoping unchanged.
- **Tests (DC-05):** behavioral pin via `compliance-deletion-auth.test.ts` `updateCalls`
  (the `.set` carries `developerResponse: null` when toolIds>0; revert → RED) + an over-scrub guard
  (the review `rating`/`comment` are not collaterally nulled by THIS update) + a source-text
  disclosure pin in `compliance-honesty-regression.test.ts` (`'tool_reviews.developer_response'` in
  the `anonymized` region; gating proven behaviorally). Non-vacuous.

## 2. TRAVEL / WATCH-ITEMS (rule each consciously — do NOT silently drop; the SLICE-1-③ N2 census-miss class)

- **F-3/F-4/F-5 — consumer-twin un-scrubbed financial/referral fields (§7-H DEFERRED; rule disclose-vs-defer):**
  the consumer twin's `consumers.stripe_customer_id` (`schema.ts:169`), `consumers.default_payment_method_id`
  (`schema.ts:171`), and `consumers.referral_code` (`schema.ts:173`) survive step 2 (which anonymizes
  only email/supabaseUserId/passwordHash) and are in NEITHER disclosure array. §7-H explicitly DEFERRED
  the consumer-side financial linkage as a future watch-item ("Not a blocker"); the developer-side
  `stripeCustomerId` IS nulled (step 1), so there is an undisclosed asymmetry. **RULE (build + its
  plan-audit):** either DISCLOSE them as `retainedUnscrubbed` column PATHS (path-only — DC-11; factual
  note; NO lawful-basis conclusion — the banned-conclusion class) which matches this chunk's
  disclosure-completeness purpose, OR continue to defer with the decision RECORDED. `referral_code` is
  a stable pseudonymous re-identification anchor (disclose-as-retained is the natural call;
  scrub would orphan referral attribution). NOT seal-blocking either way — but do not leave them silent.
- **Pre-existing consumer-email normalization asymmetry (SEAM, out of scope — record):** other consumer
  writers normalize differently (`ask/capture/route.ts:19`, `consumer/academic/route.ts:75` store
  `email.toLowerCase()`; `newsletter/subscribe` stores raw), so the UNTOUCHED step-2 consumer-anonymize
  (`eq(consumers.email, dev.email)`) could miss a differently-normalized consumer twin. SLICE 3's new
  normalized waitlist DELETE is strictly MORE complete than this. Belongs to the consumer-side
  family alongside F-3/4/5; do NOT fix in this recovery unless the build's plan expands scope.
- **N4 — `cron/data-retention` hard-deletes `compliance_exports` rows 30 days after `completedAt`
  (`route.ts:238-266`)** — so the `resultUrl` disclosure artifact (the proof of erasure this chunk
  invests in) is itself purged at 30d. Orthogonal to F-1/F-2; the existing separate backlog item.

## 3. ACCEPTED / NO-FIX (already ruled by ② — do NOT "fix" these; a fix would be gold-plating or regressive)

- **`dev.email.toLowerCase()` null-deref (`compliance.ts` step 2b waitlist DELETE) — NO FIX.**
  `developers.email` is `text().notNull().unique()` (schema + migration `0000_*.sql:91`); every writer
  writes a real email or the `deleted-${id}@…` sentinel — **unreachable**. And failing-closed
  (`status='failed'`, retryable) on a hypothetical null is SAFER than the old `completed`. A `?? ''`
  guard is gold-plating an impossible path; do not add it.
- **SEAM Unicode/locale `lower()` vs JS `.toLowerCase()` + no-NFC edge (waitlist DELETE) — NO FIX.**
  Theoretical, requires a non-ASCII email whose double-folding differs across engines; matches the
  whole codebase's email model (not a regression). Do not special-case.
- **Literal-execution: 2 always-green "fence" assertions** in `compliance-honesty-regression.test.ts`
  (the `retainedUnscrubbed.not.toMatch(scrub-paths)` group; the `BANNED_LEGAL_CONCLUSIONS`-over-note
  loop) — harmless anti-drift fences; their sibling positive pins carry the gate. OPTIONAL to
  strengthen; NOT required.

## 4. Frozen / unchanged surfaces (do NOT perturb)

- The deletion status-machine shape (pending→processing→completed|failed), the idempotent-`completed`
  no-op, the `catch`→`failed`, the SLICE-2 pre-txn auth-delete wiring, and steps 1-9 beyond the
  ADDITIVE F-1/F-2 scrubs. All new scrubs go INSIDE the existing `db.transaction` (atomicity +
  retry-safety inherited; the moat invariant `completed ⇒ (auth deleted ∧ DB anonymized ∧ all scrubs
  applied/correctly-gated)` extends to F-1/F-2).
- `tools.name`/`tools.slug` (RETAIN — artifact identity); the `ledger_entries` `retainedUnscrubbed`
  disclosure (add-to only, never re-word); `organizations.billing_email` (DEFER + disclosed already).
- The five public-claim census surfaces (`docs/page.tsx:615/635/639`, `settings/page.tsx:2117`,
  `email.ts`, `privacy/page.tsx`, `settlement/index.ts`) — verified untouched by SLICE 3; the F-1/F-2
  scrubs only make them MORE true. Re-run the §1 public-claim census after the fix and RULE each
  (do not silently skip — the census-miss class).

## 5. Gate + lifecycle

- **Gate baseline to re-confirm after the fix:** `cd apps/web && npx tsc --noEmit && npm run lint &&
  npx vitest run` → expect **tsc 0 · lint 0 err** (pre-existing warns only) · **vitest ≥ 4542 + your
  new F-1/F-2 tests**, 0 failed. `${PIPESTATUS}` is empty under zsh — read the `Test Files`/`Tests`
  summary lines. `packages/mcp` UNTOUCHED.
- **Lifecycle:** recovery build → executable gate (emit self-verification evidence: gate command +
  exit code + normalized digest + a diff manifest) → re-enter **② seal-gating review** (this is
  HIGH-STAKES, so ② is followed by ③). Founder-close is LOCAL commit; push only on explicit `/push-go`.
- **Defect classes in play:** DC-16 (the F-1 false-claim recurrence — close ALL siblings, prove the
  unconditional claim true OR gate it), DC-11 (resultUrl discloses column PATHS only — never a row
  value), DC-05 (new tests non-vacuous), DC-15 (keep docstring/disclosure in sync with the new
  scrubs), DC-17 (each new scrub idempotent on a `failed` retry), DC-13 (latent — over-scrub /
  collateral on the broadened audit scrub). SEAM + LITERAL-EXECUTION standing.

## 6. ② evidence (what the seal review established — so the recovery build doesn't re-derive it)

5 lens-distinct fresh-context Opus-4.8 reviewers (Agent-tool spawns; the integrator ran the
authoritative core-invariant pass at `/effort max` in the main session — ad-hoc spawns do NOT inherit
the live session effort, so spawn self-reports of effort are unreliable). Established: the 4 shipped
scrubs are correct/atomic/idempotent; the normalized waitlist DELETE matches the only writer
(`api/waitlist:149`); the tool-infra nulls are product-safe on `status='deleted'` rows (every reader
filters non-deleted statuses or only COUNTs); `audit_logs.details` + `notification_webhooks` readers
are null/`{}`-safe; the tests are non-vacuous (8 reverts proven RED, tree restored byte-identical);
`organizations.billing_email` is correctly deferred + honestly disclosed (no banned conclusion); the
region-slice anchors are unique and correct. The ONLY open defects are F-1 and F-2.
