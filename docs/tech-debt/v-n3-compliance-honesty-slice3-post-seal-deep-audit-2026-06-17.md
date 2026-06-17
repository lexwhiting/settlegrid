# V-N3 compliance-honesty SLICE 3 (RECOVERY, SEALED) — ③ POST-SEAL DEEP-AUDIT RECORD (2026-06-17)

> The ③ integrated-whole audit of the SEALED SLICE-3 recovery build. Verdict: **RE-CERTIFIED
> (hardened)**. Base = the uncommitted working tree on `main @ c3b78fce`; LOCAL, **NOT pushed**.
> Input brief: `…-slice3-post-seal-deep-audit-handoff-2026-06-17.md`. Seal:
> `…-slice3-seal-2026-06-17.md`. DC-16 ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.

## Verdict
**RE-CERTIFIED — hardened.** Zero sustained code defects in the shipped `processDataDeletion` or the
integrated whole. Two genuine **test-vacuity** gaps (shipped code correct, the tests under-pinned the
blast-radius-critical SQL operator / disclosure shape) were closed fix-first with live-reproduced,
non-vacuous assertions. The ②-sealed consumer-twin MED is re-confirmed NON-BLOCKING and stays routed
to the consumer-side normalization chunk. The §1.A claim-honesty census re-ruled clean.

## Gate (re-derived from scratch this session — TWICE: pre-audit clean baseline, and post-hardening)
- Pre-audit (clean isolated): `tsc` 0 · `lint` 0 err (8 pre-existing warns) · **vitest 4555 / 197 / 0**
  (matches the seal baseline exactly).
- Post-hardening: `tsc` 0 · `lint` 0 err · **vitest 4557 / 197 / 0** = 4555 + **2** new ③ tests.
- packages/mcp UNTOUCHED. apps/web-only diff (now `compliance.ts` + 3 test files, 671/33).

## Scope & method
Integrated-whole audit distinct from the diff-scoped ②. Mechanical pre-flight first (gate re-derived;
audit_logs writer census re-derived fresh = ~33 prod `writeAuditLog` sites, `audit.ts:16` the sole
`db.insert(auditLogs)` sink; consumer-email normalization ground-truthed at source; caller reachability;
deletion-claim surface census; reader null-safety). Then a 5-lens break-the-shipped-code fan-out
(correctness · SEAM · literal-execution · defect-recurrence · integration-security) **run as a workflow**
at session xhigh, every reviewer adversarially verified, all confirmed `claude-opus-4-8[1m]`. The decisive
DC-16 claim-honesty re-census + the §1.B consumer-twin ground-truth + the collective-miss critic ran
in-session (max-tier work; PATH 1 unavailable so no mixed-effort fan-out).

## Findings folded (fix-first, live-reproduced)
- **F-A (MED → CLOSED) — step-2b waitlist DELETE SQL-operator vacuity.** The two step-2b tests asserted
  only `pred.sql.values` (the bound email), never `pred.sql.strings` (the literal `lower(…) = ` text),
  though the drizzle mock captures it. `waitlist_signups` is a GLOBAL marketing table keyed only by email
  (no developer FK), so a one-char regression `lower→upper` / `=→<>` would silently convert the
  subject-scoped DELETE into a whole-table wipe of EVERY user's signup — and pass CI green (bound value
  identical) AND `tsc` 0. **Fix:** a new test pins `pred.sql.strings.join('')` — requires `lower(`, an
  `=`, and forbids `<>`/`!=`/`upper(`. **Live repro:** mutating `:583` to `upper(…) <> …` turns ONLY the
  new test RED (old value tests stay green); restore → byte-identical (md5 `d2f5145a`), 25/25 green.
- **F-B (LOW → CLOSED) — resultUrl disclosure-array shape vacuity (DC-11 guard).** The disclosure tests
  used only `toContain`/`not.toContain` membership — blind to an EXTRA leaked element. A future edit
  interpolating `dev.email` (a row VALUE) into `anonymized`/`retainedUnscrubbed` would pass every existing
  assertion. **Fix:** a new test asserts every entry of `anonymized`/`retained`/`retainedUnscrubbed`
  matches a `^[a-z_]+(\.[a-z_]+)*$` column-path shape and that the serialized artifact never contains the
  subject email. **Live repro:** injecting `dev.email` into `anonymized` turns ONLY the new test RED;
  restore → byte-identical, 25/25 green.

Both fixes touch ONLY the already-in-diff test file `compliance-deletion-auth.test.ts` — no source change,
no frozen surface perturbed, no deferred work pulled in. They extend the seal's predicate-capture seam
from "pin the PREDICATE shape/value" to also "pin the literal SQL operator/function" and "pin the
disclosure-array shape" — closing the worst concrete instance of the accepted DC-05/DC-10 unit-mock residual.

## Findings ruled NON-BLOCKING / out-of-scope (no fold)
- **Consumer-twin normalization MED (②-sealed, re-confirmed).** Ground-truthed at source: `auth/callback:128`
  stores `user.email` RAW and writes that same value to BOTH `developers` and `consumers` in one OAuth flow →
  an OAuth twin is byte-identical → the byte-exact twin lookup MATCHES. `ask/capture` + `consumer/academic`
  store `email` via a zod `.trim().toLowerCase()` transform. The lookup misses ONLY the cross-path case
  (developer email mixed-case via OAuth raw + consumer twin lowercased via a normalizing route). `developers.email`
  is itself stored raw — a systemic identity-layer normalization issue, not a spot-patch. Frozen step-2 surface
  (and the pre-txn `:486` auth lookup); a missed cross-path twin has no `supabaseUserId` (only OAuth twins do,
  and they match) so no orphan auth user; consumer-keyed `details` carry IDs/amounts/key-prefixes, no email →
  the unconditional `audit_logs.details` claim concerns the DEVELOPER's PII (scrubbed by step 5) and is not
  falsified. → stays routed to the consumer-side normalization chunk.
- **DC-16 claim-honesty census (§1.A) — re-ruled clean.** Complete deletion-claim surface census = `docs/page.tsx`
  (FAQ family), `privacy/page.tsx`, `(dashboard)/dashboard/settings/page.tsx`, `email.ts accountDeletedEmail`
  (`review-policy` is review-moderation, irrelevant). All under-claim or are honest; the new disclosed-as-retained
  consumer financial/referral + `organizations.billing_email` create NO new inter-surface contradiction (no FAQ
  claims those are scrubbed). The `docs:652` "request deletion through the API" copy (no deletion route exists),
  the `email:734` "30 days … permanently removed" / `settings:2155` "plus 90 days" retention-window wording vs the
  7-year financial retention, and the no-self-serve-trigger settings button are all **PRE-EXISTING, on FROZEN
  surfaces the diff does not touch** → tech-debt/travel, not SLICE-3 regressions (multiple lenses independently
  reached the same out-of-scope ruling).
- **`organizations.billing_email` unconditional disclosure vs consumer-paths gated (collective-miss).** A
  non-action disclosure ("this deletion does not scrub org data") is universally true; the consumer-path gating
  is a stricter honesty choice. Both honest. INFO-only; no fold.
- **server-only barrel guard (integration LOW), N4 cron 30-day purge, the DC-05/DC-10 unit-mock residual** — all
  pre-existing/accepted, no present-day defect; carried forward unchanged.

## ⚠ AUDIT-METHODOLOGY HAZARD (process finding — NOT a code defect; the two false-HIGH verdicts)
Two workflow verifiers (integration-security #5, defect-recurrence DC-17) reported a HIGH "the `upper(…) <> …`
catastrophic global-table wipe is ALREADY SHIPPED." **This is FALSE — an artifact of the audit's own
orchestration.** The mutation-testing reviewers were given Bash write access and ran their `upper<>` vacuity
experiments **concurrently against ONE shared working tree** (the fan-out did not use `isolation:'worktree'`),
so a verifier read `compliance.ts:583` at the instant a SIBLING agent's mutation was live on disk. Three other
verifiers independently diagnosed the collision ("a concurrent external mutation harness was toggling
compliance.ts between lower= and upper<>… environment artifact, not a code defect"). The integrator
ground-truthed the quiescent tree directly: `:583` = `lower(…) = …`, residue scan CLEAN across all 4 files,
md5 `d2f5145a` stable, gate green. **Lesson (sibling of DC-05 — the verification apparatus emitting a false
signal):** any audit fan-out whose reviewers MUTATE shared source for mutation-testing MUST isolate each in its
own git worktree (`isolation:'worktree'`), or restrict mutation to a single serialized agent; otherwise
concurrent in-place edits corrupt cross-agent reads and manufacture false-positive HIGHs. Recorded as a
detection-cue addition under DC-05; no product-ledger class minted (it is an audit-harness hygiene class, not a
SettleGrid code-defect class).

## Defect-class ledger touchpoints
DC-16 (claim-honesty census re-ruled clean; consumer-twin sibling re-confirmed routed) · DC-05/DC-10 (the F-A/F-B
test-vacuity gaps closed — pin `sql.strings` + disclosure-array shape, not only `sql.values`/membership; plus the
new concurrent-mutation-shared-tree audit-harness cue) · DC-11 (paths-only — now test-pinned) · DC-13 (5c
over-scrub ruling unchanged) · DC-17 (idempotent retries re-verified). SEAM + LITERAL-EXECUTION exercised, no
recurrence.

## Lifecycle
RE-CERTIFIED (hardened) → founder-close is a LOCAL commit (path-scoped). Push only on explicit `/push-go`.
