# V-N3 (compliance-honesty SLICE 2) → ③ POST-SEAL DEEP-AUDIT HANDOFF (2026-06-16)

> ② SEAL-GATING REVIEW COMPLETE → operator `/seal-go` CONFIRMED → cadence phase `sealed`. LOCAL only,
> never pushed. Base = `main` @ `9fa0bdbb`. This is the input to ③ (the HIGH-STAKES post-seal deep
> audit). Read the ②-seal record (`v-n3-compliance-honesty-slice2-seal-2026-06-16.md`) and the
> ①-build-handoff (`v-n3-compliance-honesty-slice2-handoff-2026-06-16.md`) first; the SLICE-1 ③ entry
> in `.audit/defect-ledger/DC-16-public-claim-content-integrity.md` is where the findings this chunk
> closes were originally routed out.

---

## 0. What ② did
Independent, hostile, fresh-context review of the BUILT diff: a new server-only admin module
(`apps/web/src/lib/supabase/admin.ts`, +75 lines) + the `processDataDeletion` wiring
(`compliance.ts`, +55/-8) + 3 copy rewords + 2 new test files + 3 modified test files (+179/-20
overall). 5 lens-distinct Opus-4.8 reviewers (correctness/determinism · spec-conformance · DC-16
core-invariant: data-integrity & claim-honesty · SEAM · literal-execution/test-vacuity); the
integrator reproduced the central LB-1 guarantee LIVE (break→RED→revert→GREEN) and re-ran the gate
clean isolated. **0 high · 0 sustained medium; all findings LOW.**

**Effort/orchestration note (policy):** PATH 1 (effort-bearing named subagents) unavailable — no
`.claude/agents/` pool carries `effort: max/xhigh`, and a running agent cannot stand one up mid-run.
Operator chose "xhigh, one switch" and ran `/effort xhigh` before the spawn, but the 5 reviewers
self-reported `effort=high` (subagent effort introspection is unreliable; not credited as
confirmed-xhigh per the report-back guard). The integrator compensated by re-driving the
core-invariant lens + the live LB-1 reproduction in the confirmed-xhigh main session. **③ should run
the DC-16 core-invariant / claim-honesty lens at `/effort max`** (Path-2 operator switch or Path-3
process) — the one coverage element ② could not realize at the policy's preferred per-agent tier.

## 1. Gate evidence (RE-VERIFIED clean isolated, 2026-06-16)
| check | baseline @ `9fa0bdbb` | ② re-run |
|--|--|--|
| apps/web `tsc --noEmit` | 0 | **0** |
| apps/web `lint` | 0 err | **0 err** (pre-existing warns only, none in touched files) |
| apps/web `vitest` | 4506 / 195 | **4523 / 197** exit 0 (+17 = the 2 new test files + 7 regression additions; nothing else moved) |
| packages/mcp | untouched | NOT re-run (apps/web-only diff; `git status` confirms) |

⚠ GATE-RUN HAZARD (recorded by prior seals): never run apps/web `vitest` concurrently with
packages/mcp `npm run build` (dist-rebuild race). N/A here (mcp untouched) but holds for ③ if it builds
mcp. Note: the gate chain uses bash `${PIPESTATUS}` which is empty under zsh — read the printed
`Test Files`/`Tests` summary lines for the true vitest result, not just the chain exit code.

## 2. Tier — RE-CONFIRMED HIGH-STAKES (no escalation, no silent lowering)
Changes the account-DELETION behavior (a PII/erasure boundary), introduces a new external irreversible
side effect (`auth.admin.deleteUser`) into the deletion flow, adds a service-role god-mode client, and
corrects PUBLISHED + RECORDED compliance claims. Low code-complexity; the GDPR/trust + external-API
failure-mode surface make it HIGH-STAKES. Realized diff stayed WITHIN the ①-handoff scope; no
frozen-surface touch (status-machine shape unchanged; no organizations/cron/payer-scrub/rename;
privacy page untouched).

## 3. What ② VERIFIED at source (load-bearing — ground-truthed, NOT inspected)
- The moat invariant `completed ⇒ (auth user deleted ∧ DB anonymized)` holds on every traced path;
  reproduced LIVE (swallow the auth-delete error → run reaches `completed` → fail-closed test RED;
  revert → GREEN).
- 404-idempotency (numeric top-level `error.status === 404`) + `validateUUID`-throws-on-non-UUID
  verified against installed `@supabase/auth-js@2.99.2` source.
- HARD delete (no soft-delete arg; arity pinned); FAIL-CLOSED static no-secret throw; admin-client
  constructor module-PRIVATE (only `deleteSupabaseAuthUser` exported).
- Pre-txn `supabaseUserId` capture necessary (txn steps 1/2 NULL both); raw `dev.email` at the consumer
  lookup; unique `consumers.email`; dev+twin de-duped to one `deleteUser`.
- Server-only banner matches the `rails.ts` precedent; no `'use client'` chain reaches `admin.ts`.
- All reworded claims TRUE + non-absolute; disclosure (`resultUrl.anonymized` gains `supabase_auth_user`
  gated on presence) and docstring (retargeted to the `'failed': RETRYABLE` proof block, `H1,
  2026-06-05` literal preserved) in sync.

## 4. RESIDUALS for ③ (all NON-BLOCKING; claims/behavior correct, verified)

### LOW — `settings:2117` copy expanded beyond the minimal spec (spec-3 / DC-15)
The build softened "all associated data" AND added "Financial records required for tax compliance are
retained but anonymized." — a NEW live user-facing claim the §7-G disposition did not request. TRUTHFUL
and consistent with `docs:635/615`; arguably more honest. **③/founder decision:** keep vs. revert to
the minimal softening. If kept, it is a new DC-16 surface to keep in the census going forward.

### LOW — `docs:615` soft-completeness vs retained developer-keyed PII (moat-1 / DC-16; the deletion-COMPLETENESS sub-theme from SLICE-1 ③)
"...anonymize the personal data that identifies you across your developer profile and **the records
that reference you**" — the absolute "wherever it appears" was correctly dropped, but
`organizations.billing_email` (a raw developer email, un-anonymized if the developer owns an org) is
still untouched by the 9-step deletion (routed-out N3). A literal reader could over-read "records that
reference you." Run the **DC-16 claim-honesty lens at `/effort max`** against the FULL schema to decide
whether the copy needs tightening or N3 (org-data scrubbing) must land first. Entangles with the
routed-out deletion-completeness follow-up.

### LOW — latent / forward (record, do not necessarily fix)
- **corr-1 (DC-13):** a throw between the txn commit and `return {status:'completed'}` would clobber
  `completed`→`failed` and drop `supabase_auth_user` from the retry manifest. Unreachable today
  (`logger.info` `meta` is all primitives). A future-hardening option: don't overwrite a committed
  `completed` in the catch — but that touches the frozen status-machine; weigh carefully.
- **corr-4 / seam-4:** confirm the deployed GoTrue emits HTTP 404 for an already-deleted user; add an
  unmocked non-UUID test for `deleteSupabaseAuthUser` (the `validateUUID`-throws path is verified vs SDK
  source but not exercised in-suite).
- **moat-2 / moat-3:** `processDataDeletion` does not branch on `entityType` (consumer-only deletion →
  "Developer not found" → never completes; safe) and a non-UUID stored `supabaseUserId` makes an account
  un-deletable (safe direction). Fold into the future deletion-route precondition.
- **lit-6 (DC-05):** the docstring retry-safety test matches tokens against the whole docstring region,
  not the `'failed'` bullet specifically. Optional test tightening (test-only, low-risk).

### ⚠ Operator/infra preconditions (forward — surfaced at seal; NOT code blockers)
1. **`SUPABASE_SERVICE_ROLE_KEY` provisioned in prod (Vercel)** — feature inert until then (fail-closed).
2. **Zero pre-existing `status='completed' ∧ request_type='data-deletion'` rows** — UNVERIFIED by ②
   (no DB access); strong prior zero (no HTTP caller ever). If any exist → one-off backfill (the
   completed no-op won't retro-cover them). **Operator must confirm before shipping.**
3. **Future deletion-route authz** — derive subject from `requireDeveloper→auth.id`, never a
   client-supplied id, branch on `entityType`, rate-limit; no auto-retry driver for `failed` today.

### Adjacent / OUT-OF-SCOPE (do NOT fold under this seal — routed follow-ups / legal-gated)
- **N3** — `organizations.billing_email` / org-member data scrubbing on developer deletion →
  deletion-completeness follow-up (entangles with moat-1).
- **N4** — the `data-retention` cron purging completed data-DELETION rows at 30 days vs the "90 days"
  claim → backlog (scope the purge to `request_type='data-export'`).
- **N5** — "anonymized" vs "pseudonymized" framing (preserved UUID + deterministic email) → counsel.
- **V-N3-erasure** — the on-chain payer-address erasure / `ledger_entries` `operation_id`+`metadata.payer`
  scrub (lawful basis + retention + dedup-key redesign; founder + counsel).

## 5. Defect-class touchpoints (folded at seal)
- **DC-16** — the SLICE-1 ③ HIGH routed-out finding (`docs:635` false auth-deletion claim) CLOSED
  behaviorally; the two MED routed-out findings (email "permanently deleted"; `docs:615` "wherever it
  appears") CLOSED by reword (recorded in the ledger).
- **DC-08** — FAIL-CLOSED-on-missing-key fail-mode chosen correctly (not a silent no-op); verified live.
- **DC-17** — pre-txn auth-delete idempotent on 404 → `failed` retry-safe, `completed` never re-run
  unsafely.
- **DC-11** — service-role admin sink narrowly scoped (only `deleteSupabaseAuthUser` exported).
- **DC-05** — all 17 new tests non-vacuous (integrator-reproduced live).
- **DC-15** — docstring/disclosure synced with the new behavior; spec-3 settings expansion is the only
  mild plan-drift (non-false).

## 6. ③ scope & method
HIGH-STAKES integrated-whole audit. Run the **DC-16 core-invariant / claim-honesty lens at `/effort
max`** (Path-2 operator switch or Path-3 process) — the tier ② could not realize per-agent. Prioritize:
(a) **moat-1** — do the reworded public claims hold against the FULL schema, or does
`organizations.billing_email` (N3) make `docs:615` over-read? (b) the integrated whole — is the
now-irreversible `auth.admin.deleteUser` reachable by any caller today (seam-3: no HTTP route), and
what changes when a deletion route lands (the 3 preconditions)? (c) the SLICE-1 ③ pattern: re-census
for ADJACENT untouched surfaces a diff-scoped seal cannot see. ③ MAY correct the LOW residuals
(test/comment-only, low-risk) with non-vacuity re-proven and the gate re-run, if it judges fit. Do NOT
pull in V-N3-erasure or any legal-gated work. Founder-close is a LOCAL commit (path-scoped, NEVER
push); `/push-go` is a separate explicit gate.
