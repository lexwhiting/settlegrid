# V-N3 compliance-honesty SLICE 4 — ③ POST-SEAL DEEP AUDIT HANDOFF (2026-06-18)

> Standalone handoff for a FRESH ③ audit session. READ THIS FIRST. Repo: `/Users/lex/settlegrid` (npm
> monorepo `apps/web` + `packages/mcp`; use **npm**). SLICE 4 is **SEALED** (② passed, operator `/seal-go`
> confirmed, 2026-06-18) — LOCAL, **NOT committed, NOT pushed**. This ③ is the integrated-whole audit: the
> diff-scoped ② cannot see adjacent UNTOUCHED surfaces, and the SLICE-1/2 history shows a **census-miss
> class** (a deletion-claim surface the diff review can't see). Base = `main` @ `075115d7`. Seal record:
> `v-n3-compliance-honesty-slice4-seal-2026-06-18.md`. DC-16 ledger:
> `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.

## 0. What ② already established (do NOT re-derive — verify + extend)
- **Gate GREEN, re-derived clean TWICE** (review + seal): `tsc` 0 · `lint` 0 err (8 pre-existing warns) ·
  `vitest` **4566/197/0** (4557 baseline + 9). `compliance.ts` shasum
  `724e1a2719b01043e50c8c2ac8aa805a1344dd9f` (re-confirm it is UNCHANGED before you start — treat any drift
  as RED and re-derive).
- **② verdict: SEALED, 0 high open.** 4 fresh-context Opus-4.8 lenses (correctness/determinism ·
  spec-conformance · SEAM · literal-execution) + the integrator's `/effort max` DC-16 core-invariant pass.
  Spec MATCHES on A–F. The two "most likely silently wrong" decisions (twin-lookup determinism;
  `referral_code = SCRUB`) are built-as-resolved and ground-truthed at source.
- **The diff** = `compliance.ts` (6 authorized hunks) + `compliance-deletion-auth.test.ts` +
  `settlement-moat.test.ts`. Everything else frozen.

## 1. The scoped-forward items ③ must RULE (each in its destination; do not silently drop)
- **F-1/F-2/F-3 — the single-row `LIMIT 1` twin model under-deletes a coexisting case-variant SIBLING**
  (MED, one root cause). When two+ `consumers` rows for one subject coexist (`Bob@X.com` raw via OAuth +
  `bob@x.com` via ask/capture — reachable: `consumers.email` UNIQUE is on RAW, no `lower(email)` index), the
  deterministic lookup scrubs the byte-exact row and LEAVES the sibling (F-1), de-references only the
  resolved row's `supabaseUserId` (F-2; largely absorbed by `auth/callback` storing the dev email RAW into
  both dev+consumer, so dev.email byte-matches the supabaseUserId-bearing OAuth twin), and pre-txn(`db`) vs
  step-2(`tx`) are separate READ-COMMITTED snapshots (F-3 concurrent-split). **PRE-EXISTING** (SLICE-3's
  `eq().limit(1)` was also single-row), **not worsened**, conditional, DORMANT. **③ ruling task:** confirm
  the "pre-existing + not-worsened" claim independently (diff the old vs new lookup behavior per scenario);
  decide whether the **all-rows fix** (`inArray(consumers.id, ids)` over ALL `lower(email)` matches for
  every consumer-scoped write + every distinct `supabaseUserId` in the auth-delete) lands as its own
  follow-up chunk or is acceptable as standing tech-debt. The seal's position: route to a follow-up; do NOT
  fix under ③ unless ③ escalates it to blocking with new evidence.
- **F-4 (LOW)** `dev.email=''` matches an unrelated empty-email consumer — fold the one-line guard into the
  same follow-up (practically impossible; auth populates a real email; dormant).
- **SEAM gating uniformity (LOW)** `consumer_schedules`/`conversion_events.metadata`/consumer `api_keys`
  disclosed gated on twin-EXISTENCE not rows-MATCHED — non-false under the "column PATHS only" contract,
  matches the `tool_reviews`/`invocations.metadata` precedent. Optional uniformity hardening.

## 2. The decisive ③ lenses (size to high-stakes; this is the LAST line of defense for the whole surface)
- **(MAX) DC-16 claim-honesty, CROSS-SURFACE census** — ② proved the resultUrl `anonymized`/
  `retainedUnscrubbed` arrays are internally consistent (every disclosed path has a backing scrub on an
  identical gate; no row values; the false referral rationale removed). ③ must check the **OTHER live
  deletion-claim surfaces** for an inter-surface contradiction introduced by SLICE-4's new
  *disclosed-as-anonymized* consumer fields. The SLICE-3 ③ established the COMPLETE surface set:
  `apps/web/src/app/docs/page.tsx` (FAQ family), `app/privacy/page.tsx`,
  `app/(dashboard)/dashboard/settings/page.tsx`, `lib/email.ts accountDeletedEmail`. Re-walk each: does any
  now contradict "we scrub your consumer stripe/payment/referral + schedules + conversion metadata + API
  keys on deletion"? (Expected CLEAN — the new claims are MORE erasure, and those surfaces under-claim — but
  prove it.) Re-confirm the pre-existing FROZEN-surface copy drifts the SLICE-3 ③ logged (`docs:652` "delete
  through the API" with no deletion route; `email`/`settings` 30-/90-day "permanently removed" vs 7-yr
  financial retention) are unchanged travel items, not SLICE-4 regressions.
- **(MAX/xhigh) COMPLETE consumer-keyed-PII deletion-surface census (the census-miss class)** — the ②
  spec lens confirmed the BUILT set matches handoff §2C, but ③ must independently answer: **is §2C
  EXHAUSTIVE?** Enumerate EVERY table with a `consumerId`/consumer-email column (grep schema.ts for
  `consumers.id` FKs + `consumer_id` + email columns) and rule each: scrubbed, disclosed-as-retained, or a
  silent MISS (consumer PII neither scrubbed nor disclosed = a GDPR under-deletion + a DC-16 silent gap).
  Known-ruled: `apiKeys`/`consumerSchedules` (DELETE), `conversionEvents.metadata` (SCRUB),
  `outcomeVerifications.disputeReason` (NO-ACTION — opaque non-FK id), `consumerToolBalances`/
  `consumerAlerts`/`purchases`/`invocations`/`referredByConsumerId` (no-action). Hunt for an UN-enumerated
  one (e.g. any consumer-authored free-text/jsonb the census didn't list).
- **(xhigh) correctness / SEAM / literal-execution on the SEALED whole** — re-validate the determinism +
  idempotency + frozen-surface claims against the integrated function (not just the diff). Reader
  null-safety for the newly-nulled columns (any reader of `consumers.stripe_customer_id`/
  `default_payment_method_id`/`referral_code` or `conversion_events.metadata` that assumes non-null?).
- **(xhigh) collective-miss critic** — "what modality did we NOT run, what claim is unverified, what
  consumer-keyed surface is unread?"

## 3. Orchestration / policy (carry the SLICE-3 ③ lessons)
- **Model** pinned `claude-opus-4-8`; reviewers REPORT model + effort actually run. **Env** must be clean
  (assert FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL unset before any decisive fan-out).
- **PATH 1 unavailable** (no `.claude/agents/` effort-bearing pool). A `max` lens cannot run inside a single
  workflow; realize it as a Path-2 operator `/effort max` pass (or Path-3 process), the `xhigh` breadth
  separately. Allowlist GREEN for git/tsc/lint/vitest + `settlegrid-discovery` MCP.
- **AUDIT-HARNESS HAZARD (SLICE-3 ③, do NOT repeat):** mutation-testing reviewers given NO `isolation:
  'worktree'` edited ONE shared tree concurrently and produced false-HIGH "already shipped" verdicts. If ③
  runs source-mutating reviewers, give them **worktree isolation** or **serialize** the mutation, and the
  integrator ground-truths the quiescent tree (shasum) before crediting any "already broken" finding.

## 4. Frozen / unchanged (do NOT perturb)
Everything ② froze (seal record "Frozen-surface compliance"): developer steps beyond the consumer-twin-gated
additions, the status machine, the idempotent-`completed` no-op, `catch`→`failed`, `tools.name/slug`,
`organizations`/`organization_members` deferral, the `ledger_entries` payer scrub (V-N3-erasure), the
`data-retention` cron, `packages/mcp`. ③ is an AUDIT — it fixes only a test-vacuity gap it can live-reproduce
(SLICE-3 ③ precedent: fix-first, test-file-only, non-vacuous), never a frozen production surface.

## 5. Gate + founder-close
- **Gate:** `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err ·
  vitest ALL-pass (current **4566**; any ③ hardening test ADDS). `${PIPESTATUS}` empty under zsh — read the
  `Test Files`/`Tests` summary lines.
- **Founder-close** (after ③ RE-CERTIFIES): a single **path-scoped LOCAL commit** of
  `apps/web/src/lib/settlement/compliance.ts` + the 2 test files + the slice-4 docs (handoff, build report,
  seal, this ③ handoff + the ③ record). **EXCLUDE `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`**
  (out-of-scope `slugify` UI change, unrelated to this chunk). `/push-go` is a separate explicit gate — do
  NOT push.

## 6. Defect classes in play
DC-16 (claim integrity — the cross-surface census + the single-row-twin under-deletion sibling), DC-11
(paths-only), DC-13 (over-scrub / NO-ACTION rulings), DC-14 (unapplied UNIQUE / stale migrations), DC-15
(docstring/note/test sync), DC-17 (idempotent retry), DC-05/DC-10 (mock evaluates names not SQL — the
two-row resolution is construction-pinned only; a real-Postgres integration test is the durable guard).
SEAM + LITERAL-EXECUTION standing.
