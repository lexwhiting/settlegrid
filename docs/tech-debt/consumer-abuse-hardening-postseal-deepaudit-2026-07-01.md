# consumer-abuse-hardening — ③ post-seal deep audit — 2026-07-01

> **Chunk:** `consumer-abuse-hardening` · **Closes:** launch-gate **G3-1** (unauth $500 academic mint) + **G3-2** (referral double-credit TOCTOU) · **Tier:** **HIGH-STAKES** (confirmed — real spendable `globalBalanceCents`; auth/authorization boundary; TOCTOU→atomic-once invariant; schema+migration; new untrusted-input boundary; 2 launch-gate blockers).
> **Scope:** the INTEGRATED WHOLE on committed tree `c83d837a` (distinct from the ② diff-scope). The DEFERRED core-invariant money/auth lens lands here.
> **Verdict:** ✅ **RE-CERTIFIED (hardened).** The money invariant HOLDS (exactly-once · entitled-only · atomic · no lost-update). Zero NEW money-loss HIGH in the shipped code under the intended (§P-correct) config. Two fix-first folds landed (3 row-scope test-teeth pins reproduced fail-then-pass + §P/§S checklist propagation); three fast-follow rows filed. Gate GREEN on the hardened bytes.

---

## 1. High-stakes confirmation
Confirmed high-stakes (multiple triggers) — the ③ post-seal deep audit is warranted. Ran to 100% autonomously.

## 2. Orchestration + policy
- **Orchestration:** operator-selected **Agent-tool spawns** (Path-1 pool absent — no `.claude/agents`; under `bypassPermissions` the workflow's loud-pause edge is moot; the deferred core-invariant lens can't be a workflow agent anyway). 5 lens-distinct fresh-context reviewers + a collective-miss critic, all `model: opus` (claude-opus-4-8[1m]), Read-only, coverage-mode. Fix-fold + verdict kept in the main session.
- **Effort:** session `xhigh` (settings `effortLevel: xhigh`; env traps `FORK_SUBAGENT`/`SUBAGENT_MODEL`/`EFFORT_LEVEL` all unset). All six reviewers self-reported `high` (model-reported effort is unreliable). The optional `max` collective-miss bump was **operator-declined** (Path-1 absent → would need a mid-run `/effort max` session switch); the critic ran at `xhigh` (no-stall). The deferred `max` core-invariant depth was realized as the `xhigh` money/auth core-invariant lens, which — with 4 corroborating lenses + a mechanical EvalPlanQual re-derivation — analytically settles the invariant at this tier.
- **Allowlist:** GREEN (git/tsc/vitest/lint/node/grep present; no MCP/WebFetch needed). No BLOCKING gap.

## 3. Mechanical pre-flight (handed to reviewers; not re-derived by them)
- **Gate GREEN on `c83d837a`:** `tsc=0 · lint=0 · vitest 221 files / 5085 pass / 0 skip / 0 fail`.
- **Migration integrity:** `sha256(0017_academic_granted_at.sql)=46802cb3…ef9686` == seeded `__drizzle_migrations` row; `drizzle/meta` untouched; working tree = only the pre-existing EXCLUDE set.
- **Hostile-input battery over `isAcademicEmail`** (29 cases): rejects every substring / non-SLD-label / double-`@` / lookalike bypass; admits only `.edu`/`.ac.*`/`.edu.*` suffixes + the founder-accepted `uni-*`/`univ-*` SLD residual. One parser-laxness (leading-space-in-domain admits) — **unreachable** (eligibility runs on GoTrue-normalized `user.email`, not body input).
- **Seam evidence:** `user.identities[].provider` already read elsewhere (`account/route.ts:382`, `settings:461`), so `identity_data.email_verified` is genuinely first-use; all 35 other `requireConsumer` callers are single-arg → the overload leaves the frozen surface unchanged.
- **Integrator cross-checks:** every `globalBalanceCents` writer is DB-side `sql\`col ± const\`` (proxy debits `:694/:934/:2699` guarded `>= cost`) → credits+debits compose with no lost update; `auth/callback` adoption (`:233-235`) sets only `supabaseUserId` and preserves `academic_granted_at` → the FOLD-5 double-claim vector is closed.

## 4. Core verdict — the money invariant is SOUND
The deferred core-invariant lens + 4 corroborating lenses independently confirm **"grant exactly once, atomically, only to an entitled caller"** for BOTH paths:
- **Academic exactly-once:** conditional `UPDATE … WHERE id=:auth AND academic_granted_at IS NULL RETURNING id`, gated `length===1`; under PG READ COMMITTED the concurrent loser re-evaluates the qual against the committed row via EvalPlanQual → 0 rows. No DC-06 trap (postgres-js `.returning().length` == affected rows). `length ∈ {0,1}` (PK), so `length!==1` is exhaustive.
- **Referral credit-both-or-neither:** one `db.transaction`; referee null-gated + rowCount-checked; referrer credited only after a 1-row referee update and itself rowCount-gated (throw→rollback). Concurrent loser matches 0 rows → credits no one.
- **Entitlement binding:** grant keyed on `auth.id`, eligibility on `auth.verifiedEmail` (live confirmed session email), never `body.email` (parsed but dead). No auth/verify/tripwire bypass beyond the documented residual.
- **No second write path:** all 20 `consumers` writers enumerated — `academic_granted_at` has one writer + the 0017 backfill; `referredByConsumerId` one writer; no admin/cron/import free-credit path.

## 5. Findings + disposition (6 reviewers, coverage mode)

### Sustained — fix-first FOLDED (landed this session, reproduced live)
- **[MED · literal-exec] Row-scoping predicate `eq(consumers.id, auth.id)` had ZERO test teeth** (DC-24 recurrence — sibling of the ②-folded `isNull` pin). Deleting the row-scope (a mass-mint to every not-yet-granted consumer) passed the suite green. Shipped code is CORRECT; the gap was test coverage on the most catastrophic line. **FOLDED:** added `expect(eq).toHaveBeenCalledWith('id','con-1')` (academic) + `expect(mockTx.where).toHaveBeenCalledWith(…)` structural pins for the referee (`and[eq,isNull]`) and referrer (`eq id=referrer`) row-scopes. **Fail-then-pass reproduced for all three** (each goes RED with its row-scope deleted, GREEN restored).
- **[MED · posture + critic] The BLOCKING §P config items the fail-closed-safety RESTS ON were absent from the operator's gating checklist.** `Confirm-email=REQUIRED`, `Secure-email-change=ENABLED`, and the two §S academic smokes existed only in the seal-record, NOT in `LAUNCH-GATE-roadmap-2026-06-27.md` §P/§S — while G3-1 is ticked ☑. The collective-miss critic ESCALATED this: the runtime auto-confirm tripwire is EVADABLE by signup-then-email-change (GoTrue stamps `email_confirmed_at` at change-time ≠ `created_at` → tripwire false → grant proceeds with no mailbox proof), so §P item 1 is the SOLE control for the email-change vector — there is no code backstop. **FOLDED:** transcribed 3 §P items + 2 §S academic smokes into the roadmap (gitignored bookkeeping; provably outside the blocker-count region — count holds 13/27 RED).

### Sustained — DOCUMENTED + FAST-FOLLOW filed (no code fold — out of chunk scope / GoTrue-dependent)
- **[MED · money lens, VERIFIED] Erasure-recycle repeat $500 mint (EXCEEDS the accepted residual).** Self-serve developer-account deletion anonymizes the consumer twin and FREES the academic email (`compliance.ts:807-819`), so the SAME real mailbox re-registers (`academic_granted_at` NULL on the fresh row) and re-claims $500, looping. High-friction (full delete + re-signup + mailbox re-confirm + step-up per $500), detectable (create→claim→delete→recreate loop), and funds are usage-credit not cash → MED, monitored, not promotion-gating at pre-PMF. Fix (fast-follow): an append-only, erasure-surviving grant key (salted hash of verified email/domain) the erasure must not reset. A `ledgerEntries`/erasure-path change is a separate subsystem + the GDPR erasure chunk's frozen surface → correctly NOT folded here.
- **[LOW · critic] Per-IP academic limiter (3/day) self-DoSes campus NAT** (pre-existing value; UX). Fast-follow: raise/re-key.
- **[MED fast-follow] Provider-gate the auto-confirm tripwire on `provider==='email'`** (kills the OAuth false-positive 403 for legit Google-Workspace `.edu` users). Depends on unverifiable GoTrue runtime behavior → fast-follow, not a seal fold.

### Correctly-deferred / documented (no action — confirmed posture)
- OAuth auto-confirm false-positive 403 → fail-closed, no money loss → §S smoke #9 (added).
- `currentEmailIsVerified` DOA risk → fail-closed, zero money loss → §S smoke #8 (added).
- 0017 backfill re-run hazard → documented + §P apply-once item; fail-closed (blocks valid claims).
- Mutual-referral deadlock → clean 500 → clean rollback (handoff A2b); mocked-txn rollback untested (inherent; live smoke books it); `/register?redirect=` dead-end (explicitly-deferred sign-in-UX follow-up).
- `institutionName` HTML interpolation → **CLEAN** (no DB column, self-inbox recipient only, structured-JSON logs — no cross-user sink).

## 6. Defect-class ledger update
- **DC-24 (toothless test control) RECURRED** on the grant row-scope predicate (sibling of the ②-folded `isNull`) — FOLDED with fail-then-pass. Standing note: the two grant/credit WHERE clauses now pin BOTH conjuncts (row-scope + null-gate).
- **NEW sub-class — SEAM(tracker): "documented-but-unpropagated gate item."** A BLOCKING §P control lived in the seal-record but never reached the operator's actual gating checklist (`launch-gate-check.sh` walks the roadmap, not the seal-record) while the code row was ticked closed. This is a seam between the seal artifact and the promotion artifact. FOLDED here; recommend a standing ②/③ step: any BLOCKING §P/§S item a seal introduces must be transcribed into the roadmap in the same pass.
- **SEAM / LITERAL-EXECUTION comment-accuracy:** no new drift (critic confirmed comments accurate, including the READ COMMITTED exactly-once argument and the honest `uni-*` residual disclosure).

## 7. Re-certification evidence
- **Gate GREEN on hardened bytes** (cwd=`apps/web`, matching `web-ci`): `tsc=0 · lint=0 (0 errors) · vitest 221 files / 5085 pass / 0 skip / 0 fail`. Count unchanged (fold adds assertions to existing tests, not new cases).
- **Fold reproduction:** all 3 row-scope pins RED-without / GREEN-with the predicate; one self-caught lint error (unused `eq` import in the referral test — the referral assertions use object-literal keys, not the imported symbol) fixed and re-verified.
- **Working-tree delta (for operator commit — a ③ hardening commit, explicit pathspec; push stays gated on `/push-go`):**
  - `apps/web/src/app/api/consumer/academic/__tests__/route.test.ts` (row-scope pin)
  - `apps/web/src/app/api/consumer/referral/apply/__tests__/route.test.ts` (referee+referrer row-scope pins)
  - `docs/tech-debt/consumer-abuse-hardening-postseal-deepaudit-2026-07-01.md` (this record)
  - `LAUNCH-GATE-roadmap-2026-06-27.md` §P/§S/fast-follow additions are **gitignored** (local bookkeeping — not committed; the PostToolUse hook recount holds 13/27 RED).
- **Frozen surfaces UNTOUCHED:** `route.ts` (both), `auth.ts`, `schema.ts`, `0017_*.sql`, `bootstrap__drizzle_migrations.sql`, `academic/page.tsx` — restored to sealed bytes (mutations used only to prove teeth, then `git checkout`-restored). The seal STANDS on the shipped code; the ③ delta is test-teeth + tracker only.

## 8. Verdict
✅ **RE-CERTIFIED (hardened).** The shipped money/authorization boundary is correct at integrated scope: grant exactly-once, entitled-only, atomic, no lost update, no double-mint. The one path to an actual mint requires a §P MISCONFIGURATION already documented as BLOCKING — now propagated into the operator's real gating checklist so promotion cannot proceed without it. Hardening: 3 row-scope test-teeth pins (regression insurance on the mass-mint line) + §P/§S propagation. Residual money surface (erasure-recycle, uni-* Sybil, per-referrer cap, tripwire OAuth false-positive) is bounded, documented, and filed as fast-follows; none is promotion-gating at pre-PMF behind the RED launch gate + sign-in gate.
