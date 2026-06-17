# V-N3 compliance-honesty SLICE 3 (RECOVERY, SEALED) — ③ POST-SEAL DEEP-AUDIT HANDOFF (2026-06-17)

> Standalone handoff for the FRESH ③ integrated-whole deep-audit session. READ THIS FIRST. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). The ② seal-gating
> review of the SLICE-3 RECOVERY build PASSED and the operator `/seal-go`'d it → cadence `sealed`, LOCAL
> (uncommitted on `main` @ `c3b78fce`), **NOT pushed**. Seal record:
> `docs/tech-debt/v-n3-compliance-honesty-slice3-seal-2026-06-17.md`. Predecessors:
> `…-slice3-handoff-2026-06-16.md` (① build + §7 plan-audit), `…-slice3-RECOVERY-handoff-2026-06-17.md`
> (recovery brief). DC-16 ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.

---

## 0. Status, base, tier, why-③
- **② verdict: SEALED.** Gate green (tsc 0 · lint 0 err · **vitest 4555/197/0**, re-derived clean
  isolated TWICE). Both prior-② HIGHs CLOSED (F-1 census-backed `audit_logs.details` to all 3 keying
  paths incl. the new step 5c; F-2 `tool_reviews.developer_response` scrub+disclose), all 7 scrubs
  mutation-verified non-vacuous, F-1 step-5c reproduced LIVE by the integrator. 0 HIGH open at seal.
- **Base = the CURRENT uncommitted working tree** (the SLICE-3 4-file diff). Do NOT revert it. ③ is a
  POST-SEAL audit of the SEALED code AS A WHOLE — not a re-review of the diff in isolation.
- **Tier: HIGH-STAKES** (PII/erasure boundary; atomic anonymization txn; published compliance
  disclosure). ③ is warranted precisely because the diff-scoped ② **cannot see adjacent, untouched
  surfaces** — the SLICE-1/2 ③ "census-miss / partial-fix-leaves-a-sibling" class lives there.
- **Dormancy (mitigant, not excuse):** `processDataDeletion` still has NO prod HTTP route caller
  (SLICE-2 ③ confirmed; re-confirm in ③). Behavior is correct-now-but-dormant; audit on the correct-now
  standard.

## 1. THE LOAD-BEARING ③ FOCUS (where a silent miss would hide — concentrate `/effort max` here)

### A. DC-16 integrated claim-honesty re-census (the recurrence-prone center)
Re-rule EVERY live deletion-claim surface against the NOW-realized scrubs — the scrubs make them MORE
true, so likely no edit, but RULE each consciously (do NOT silently skip — the SLICE-1 ③ N2 census-miss
class):
- `docs/page.tsx:615/:635/:639` (the deletion FAQ family), `settings/page.tsx:2117`, `email.ts`
  (`accountDeletedEmail`), `app/privacy/page.tsx` — the LIVE privacy policy is the `.tsx`, NOT a
  `docs/legal/*.md` draft (SLICE-1 ③ correction; re-confirm).
- The persisted `resultUrl` (`anonymized` / `retained` / `retainedUnscrubbed` / `retainedUnscrubbedNote`)
  — every entry a column PATH, never a row value (DC-11); the banned-legal-conclusion CLASS still clean.
- Cross-check: do the newly-DISCLOSED-as-retained consumer fields + `organizations.billing_email` create
  any NEW inter-surface contradiction (e.g. a FAQ that implies those ARE scrubbed)?

### B. The consumer-twin disclosure-honesty MED (the sharpened DC-16 sibling — ground-truth it at max)
The ②-sealed RESIDUAL, routed here AND to the consumer-side normalization chunk. The consumer-twin lookup
`eq(consumers.email, dev.email)` (FROZEN step-2 surface) is byte-exact while `ask/capture:14-19` +
`consumer/academic:70-75` store `email.toLowerCase().trim()`. A cross-path/mixed-case twin is MISSED →
step 5b doesn't fire → the **unconditional** `audit_logs.{ip_address,user_agent,details}` claims can be
FALSE for that subject. ② ruled it NOT-blocking (frozen surface RECOVERY §2 deferred; identical-in-kind to
the pre-existing ip/ua claims; 5b strictly improved coverage; missed-twin `details` carries no email).
**③'s job (integrated whole, max):** (1) GROUND-TRUTH whether a real consumer twin can byte-differ from its
developer (does Supabase canonicalize OAuth email case? do the normalizing consumer routes actually produce
a twin for a developer-subject?). (2) Decide the FIX HOME + shape (normalization-robust twin lookup, e.g.
`lower(consumers.email)=lower(trim(dev.email))` mirroring the waitlist DELETE — but that touches the FROZEN
step-2 + the pre-txn auth lookup at `:486`, so it is a deliberate consumer-side chunk, not a spot-patch).
(3) Confirm the unconditional-vs-gated asymmetry decision: should the audit-column disclosures (`details`
AND the pre-existing ip/ua) be GATED, or is unconditional honest once the lookup is fixed? Do NOT fix here
unless ③ explicitly opens the consumer-side scope.

### C. Integrated-whole / integration & security
- Re-confirm NO reachable prod caller of `processDataDeletion` (grep routes/cron/jobs). If one shipped,
  the dormancy mitigant evaporates and authz/IDOR/mass-delete hardening becomes blocking.
- step 5c's whole-`details` over-scrub of ADMIN collateral (`adminEmail`/`note` on
  `resourceType IN ('developer','developer_signup')` rows): any product/admin audit-trail surface that
  reads those rows' `details` for a NON-deleted purpose and would now show empty? (Readers confirmed
  null-safe in ②; ③ confirms no semantic regression on the admin audit-trail product surface.)
- The settlement barrel re-export client-leak hazard (SLICE-2 ③ forward item) — re-confirm `compliance.ts`
  pulls in no client-leaking import via the new `waitlistSignups` import path.

### D. Defect-class recurrence + collective-miss critic
Run a dedicated collective-miss critic: "what surface/claim/keying-path did ALL the ② lenses NOT look at?"
Candidates: a deletion-claim surface outside the §1 census set; an audit_logs writer added since the census;
a consumer-keyed scrub path the §7-H family will touch.

## 2. ACCEPTED / NON-BLOCKING residuals carried in (rule, do not silently drop)
- **MED (DC-05/DC-10) — unit-mock fidelity:** the drizzle/schema test doubles echo column-NAME strings,
  not generated SQL → GREEN proves "right schema FIELD referenced" (mutation-verified), NOT "correct
  Postgres SQL." Mitigated for the diff by tsc 0 + schema confirmation. ③ consider: is a single real-SQL
  (or pglite/integration) test of `processDataDeletion`'s predicates warranted, or is the cost > value
  given dormancy? Rule explicitly.
- **LOW — the step-5c comment says "38 writers"** (actual ~33 call-sites; substance *"the ONLY writer"* is
  TRUE; it is an internal CODE COMMENT, not the persisted `resultUrl`/public copy → NOT a DC-16 disclosure
  defect). Optional one-word tidy if ③ touches the file; do not churn otherwise.
- **LOW — over-permissive dual-thenable `delete()` test mock** (latent, not exploited); one cosmetic
  docstring wrapped-line length (lint green).
- **Travel:** N4 (`cron/data-retention` purges `compliance_exports` 30d after `completedAt` → the
  `resultUrl` erasure-proof artifact is itself purged at 30d); the no-self-serve-trigger product gap (the
  settings "Delete Account" button only toasts "contact support"); pre-existing `completed` rows not
  re-scrubbed by the idempotent no-op (strong prior zero).

## 3. Frozen / unchanged surfaces (do NOT perturb in ③ unless ③ formally opens the scope)
- The deletion status-machine shape (pending→processing→completed|failed), the idempotent-`completed`
  no-op, the `catch`→`failed`, the SLICE-2 pre-txn auth-delete wiring, the consumer-twin lookup (step 2
  `eq(consumers.email, dev.email)` — the §1.B item lives in the consumer-side chunk), steps 1-9 beyond the
  sealed additive scrubs.
- `tools.name`/`tools.slug` (RETAIN — artifact identity); the `ledger_entries` `retainedUnscrubbed`
  disclosure (add-to only, never re-word); `organizations`/`organization_members` behavior (DEFER +
  disclosed). The on-chain payer-address erasure stays legal-gated (→ V-N3-erasure).

## 4. Gate + lifecycle
- **Gate baseline:** `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0
  err (8 pre-existing warns) · **vitest 4555/197/0**. `${PIPESTATUS}` is empty under zsh — read the
  `Test Files`/`Tests` summary lines. `packages/mcp` UNTOUCHED.
- **Effort/orchestration (policy):** PATH 1 unavailable (no `.claude/agents/` effort-bearing pool;
  `~/.claude*/agents` absent) — a `max` claim-honesty/consumer-twin lens is realized by an operator
  `/effort max` pass (Path 2, integrator in-session) or a Path-3 process, NOT a workflow (which can't host
  mixed effort). Allowlist clean (git/tsc/lint/vitest). Run the integrated-whole fan-out (correctness ·
  SEAM · literal-execution · DC-16 claim-honesty census · defect-class recurrence · integration/security)
  + a collective-miss critic; the integrator runs the decisive max claim-honesty + consumer-twin
  ground-truth in the confirmed-max main session.
- **Lifecycle:** ③ deep audit → RE-CERTIFY (or route findings out). Founder-close is a LOCAL commit
  (path-scoped); push only on explicit `/push-go`.
- **Defect classes in play:** DC-16 (claim-honesty census + the consumer-twin sibling), DC-11 (paths-only),
  DC-13 (the 5c over-scrub ruling), DC-05/DC-10 (mock fidelity), DC-15 (docstring/disclosure sync), DC-17
  (idempotent retries). SEAM + LITERAL-EXECUTION standing.

## 5. ② evidence (what the seal established — so ③ doesn't re-derive it)
5 fresh-context lens-distinct Opus-4.8 reviewers (correctness/spec/SEAM/literal-execution via Agent-tool
spawns) + the integrator's OWN `audit_logs` PII census at `/effort max` in-session. Established: the F-1
census claim independently re-derived 4× (chargeback-unpause is the ONLY foreign-keyed subject-PII writer;
caught by 5c); all 7 scrubs non-vacuous (mutation-tested; predicate-capture seam pins 5/5b/5c by shape);
F-1 step-5c + F-2 reproduced live (revert → RED, restore → byte-identical green); frozen surfaces
preserved; deferred fields disclosed-as-retained not scrubbed; banned-conclusion class clean; readers
null/`{}`-safe; tool-infra nulling product-safe. The ONLY open items are §1.B (consumer-twin) + the §2
accepted residuals.
