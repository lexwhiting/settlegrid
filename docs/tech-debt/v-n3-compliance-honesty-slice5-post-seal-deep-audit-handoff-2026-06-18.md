# V-N3 compliance-honesty SLICE 5 (all-rows consumer-twin erasure, SEALED) — ③ POST-SEAL DEEP-AUDIT HANDOFF (2026-06-18)

> Standalone handoff for the FRESH ③ integrated-whole deep-audit session. READ THIS FIRST. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). The ② seal-gating review
> of the SLICE-5 build PASSED and the operator `/seal-go`'d it → cadence `sealed`, LOCAL (uncommitted on
> `main` @ `25fd6f6d`), **NOT pushed, NOT yet committed**. Seal record:
> `docs/tech-debt/v-n3-compliance-honesty-slice5-seal-2026-06-18.md`. Predecessor (① build + folded pre-build
> PLAN audit): `v-n3-compliance-honesty-slice5-allrows-twin-erasure-handoff-2026-06-18.md`. DC-16 ledger:
> `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`. SLICE-4 ③ (the immediately-prior
> integrated-whole audit, for census continuity): `…-slice4-post-seal-deep-audit-2026-06-18.md`.

---

## 0. Status, base, tier, why-③
- **② verdict: SEALED.** Gate green (tsc 0 · lint 0 err · **vitest 4572/197/0**, re-derived clean isolated +
  a 6× full-suite flake loop = 6/6 GREEN). 5 fresh-context lens-distinct Opus-4.8 reviewers (correctness/
  atomicity · disclosure-honesty DC-16/DC-11/DC-15 + scope · SEAM · literal-execution+test-fidelity at the
  xhigh floor; **data-integrity MOAT at `/effort max`**) ALL CONVERGED with **ZERO high- and ZERO
  medium-severity findings**; every load-bearing claim ground-truthed by the integrator. 0 HIGH open at seal.
  `compliance.ts` shasum `15df048ea7589ddeae3ecf7e6b23c04acc5937ff`.
- **Base = the CURRENT uncommitted working tree** (the SLICE-5 3-file diff: `compliance.ts` 120+/96− +
  `compliance-deletion-auth.test.ts` 259+/77− + `settlement-moat.test.ts` 8+/13−). Do NOT revert it. ③ is a
  POST-SEAL audit of the SEALED code AS A WHOLE — not a re-review of the diff in isolation.
- **Tier: HIGH-STAKES** (PII/financial erasure boundary; the erasure txn's identity resolution went single-row
  → set-based; the auth-delete set changed; disclosure gating semantics changed; a NEW `UNIQUE(consumers.email)`
  violation vector was introduced and ruled UNREACHABLE). ③ is warranted precisely because the diff-scoped ②
  **cannot see adjacent, untouched surfaces** — the SLICE-1/2 ③ "census-miss / partial-fix-leaves-a-sibling"
  class lives there.
- **What SLICE-5 CLOSED (so ③ confirms closure, not re-opens it):** the single-row `LIMIT 1` under-deletion
  (F-1), the sibling auth-orphan (F-2), the pre-txn/in-txn snapshot split (F-3), the F-4 empty-email over-delete,
  AND the SLICE-4-③ column-side-`lower()`-without-`trim()` SEAM nit. The erasure now operates on the SET of all
  rows whose `lower(trim(email))` matches → the disclosure is universally complete.
- **Dormancy (mitigant, not excuse):** `processDataDeletion` still has NO prod HTTP route caller (re-confirmed
  in ②: only `settlement/index.ts:32` re-export + tests). Behavior is correct-now-but-dormant; audit on the
  correct-now standard. If a prod caller shipped, authz/IDOR/mass-delete hardening becomes blocking — re-grep.

## 1. THE LOAD-BEARING ③ FOCUS (where a silent miss would hide — concentrate `/effort max` here)

### A. DC-16 integrated claim-honesty re-census against the now-SET-BASED erasure (the recurrence-prone center)
The set-based change makes the consumer-side claims MORE true (it erases the sibling the single-row form left),
so likely no edit — but RULE each LIVE deletion-claim surface CONSCIOUSLY (do NOT silently skip — the SLICE-1 ③
N2 census-miss class):
- The deletion-FAQ / privacy / settings / `accountDeletedEmail` family the SLICE-4 ③ censused (the LIVE privacy
  surface is the `.tsx`, NOT a `docs/legal/*.md` draft — SLICE-1 ③ correction; re-confirm). Does any surface
  imply a per-account (single-row) erasure that the set-based "all matching rows" model would now over- or
  under-state? (Almost certainly no — but rule it.)
- The persisted `resultUrl` (`anonymized` / `retained` / `retainedUnscrubbed`) — every entry a column PATH,
  never a row value (DC-11); the per-row `deleted-<id>@…` value provably never reaches the manifest (② pinned
  T-d with ≥2 rows). Re-confirm the banned-legal-conclusion CLASS stays clean.
- Cross-check: does the set-based completeness change the truth value of the **unconditional**
  `audit_logs.{ip_address,user_agent,details}` disclosure? (② ruled it truthful — step 5 developerId +
  step-5b `consumerMatched` over the SET + step-5c resourceId together cover all keying paths. Re-confirm at the
  integrated level.)

### B. Consumer-keyed-PII deletion-surface census — re-confirm EXHAUSTIVE for the SET model (max)
The SLICE-4 ③ established **exactly 9 `references(() => consumers.id)` FKs** and ruled the 6-table consumer
scrub set exhaustive (the `api/consumer/*` write-surface closes over exactly those 6; `outcome_verifications`
carries an opaque-text `consumer_id` with no FK → NO-ACTION). ② L5 re-confirmed the 9-FK count. **③'s job
(integrated whole, max):** independently re-verify the census is STILL exhaustive under the set model — is there
a consumer-keyed PII table that is neither scrubbed (`inArray(col, ids)`) nor disclosed, OR a writer added since
the SLICE-4 ③ census? Concentrate where a new consumer-keyed table or a new `api/consumer/*` route could have
landed.

### C. The construction-pin / real-Postgres integration-test gap (T-f — the sharpened DC-05/DC-10 input)
The drizzle test doubles do NOT evaluate SQL or enforce constraints, and NO real-Postgres/pglite/testcontainers
harness exists in-repo (② L4 confirmed at repo level). So the two-row RESOLUTION + the `UNIQUE(email)`-collision
avoidance (decision #1) + the F-2 multi-auth-delete are **CONSTRUCTION-PINNED ONLY** — the `sql.strings`/inArray/
per-row-id pins catch a SOURCE regression but cannot exercise real two-row Postgres behavior. **③ decide
explicitly:** is a single real-SQL (pglite/integration) test of `processDataDeletion`'s set-based predicates
warranted now (the irreversible-erasure moat would most reward it), or is the cost > value given dormancy + the
strong construction pins? Rule it — do NOT silently carry it a third slice.

### D. The intermittent test-rig flake (LOW, carried) — decide fix-home or accept
The SLICE-5 auth-set tests + the moat retry test intermittently report `'failed'` vs `'completed'` (~1/30 under
full-suite CPU load); ② traced it to the auth-rig's shared module-level mutable arrays (`vi.hoisted`
`selectQueue`/`selectCalls`/…) + vitest worker scheduling — NOT erasure logic (`processDataDeletion` has zero
shared mutable state). ③ decide: is the rig's module-global mutable-array pattern worth a fix (file-local state
/ `test.sequential`), or accept as a known intermittent? Do NOT churn the rig under seal unless ③ opens the
scope.

### E. Defect-class recurrence + collective-miss critic
Run a dedicated collective-miss critic: "what surface/claim/keying-path did ALL 5 ② lenses NOT look at?"
Candidates: a deletion-claim surface outside the §1.A census set; a consumer-keyed writer added since the SLICE-4
③ census; whether the per-row anonymize loop (N updates) interacts with any trigger/materialized-view/audit
writer at the integrated level; whether the set-based change has any consequence for the developer-side steps
that share the txn.

## 2. ACCEPTED / NON-BLOCKING residuals carried in (rule, do not silently drop)
- **MED→LOW (DC-05/DC-10) — construction-pin gap:** see §1.C (the load-bearing decision, routed there).
- **LOW — intermittent rig flake:** see §1.D.
- **LOW (DC-14) — stale `drizzle/meta` snapshot vs `schema.ts`** (Clerk-era `consumers`, no `supabase_user_id`/
  `referral_code`; F-A): pre-existing, does NOT affect runtime (executes `schema.ts`-derived DDL + live DB) or
  any ② verdict. Travel item — the migrations are NOT a reliable second source on the `consumers` constraints;
  `schema.ts` is. Do not fix under this seal.
- **Accepted data-integrity residuals (unchanged, not worsened, DORMANT):** a consumer row INSERTED after the
  pre-txn capture (a re-run catches it); `audit_logs.consumerId` `onDelete:'set null'` (the lone non-cascade
  consumer FK) → a concurrent sibling hard-delete between capture and step-5b could leave its audit rows
  un-nulled; `trim()` strips LEADING/TRAILING only → an internal-space/NBSP twin still escapes. Do NOT add
  locking/serializable (over-engineering a dormant path).
- **Travel (pre-existing):** `cron/data-retention` purges `compliance_exports` 30d after `completedAt` → the
  `resultUrl` erasure-proof artifact is itself purged at 30d (N4); the no-self-serve-trigger product gap (the
  settings "Delete Account" button only toasts "contact support"); pre-existing `completed` rows not re-scrubbed
  by the idempotent no-op.

## 3. Frozen / unchanged surfaces (do NOT perturb in ③ unless ③ formally opens the scope)
- The deletion status-machine shape (pending→processing→completed|failed), the idempotent-`completed` no-op, the
  `catch`→`failed`, the atomicity contract (`completed` set ONLY at the final in-txn step), the pre-txn
  auth-delete wiring, steps 1/1b/2b/3–8 beyond the SLICE-5 consumer-twin set re-keys.
- The developer audit scrubs (steps 5 + 5c, developerId/resourceId-keyed); `tools.name`/`tools.slug` retention
  (artifact identity); the `ledger_entries` payer scrub `retainedUnscrubbed` disclosure (add-to only, never
  re-word); `organizations`/`organization_members` deferral (DEFER + disclosed); the on-chain payer-address
  erasure stays legal-gated (→ V-N3-erasure); `outcome_verifications.dispute_reason` NO-ACTION (opaque non-FK
  `consumer_id`); `data-retention` cron; `packages/mcp`.
- `tools/page.tsx` (out-of-scope `slugify` UI tree noise) — stays untouched, **EXCLUDE at founder-close**.

## 4. Gate + lifecycle
- **Gate baseline:** `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err
  (8 pre-existing `<img>`/react-hooks/unused-disable warns) · **vitest 4572/197/0**. `${PIPESTATUS}` is empty
  under zsh — read the `Test Files`/`Tests` summary lines. `packages/mcp` UNTOUCHED. (Re-derive clean isolated;
  if the rig flake surfaces, re-run — it is a known intermittent, NOT a SLICE-5 regression.)
- **Effort/orchestration (policy):** PATH 1 unavailable (no `.claude/agents/` effort-bearing pool) — a `max`
  claim-honesty / core-invariant lens is realized by an operator `/effort max` pass (Path 2, integrator
  in-session) or a Path-3 process, NOT a workflow (which can't host mixed effort). Allowlist clean
  (git/tsc/lint/vitest/npm-test in caps; `settlegrid-discovery` MCP enabled; no WebFetch needed). Env clean
  (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL all unset). Run the integrated-whole fan-out (correctness ·
  SEAM · literal-execution · DC-16 claim-honesty census · consumer-keyed-PII census · defect-class recurrence/
  collective-miss critic) + the integrator's decisive `/effort max` DC-16 + census ground-truth in the
  confirmed-max main session. **NOTE the ②/plan "can't read the knob" effort report-back artifact:** Agent-tool
  reviewers inherit the session effort but self-report `high`; treat the self-report as a known-unreliable
  measurement, lean on convergence + source-level ground-truth + (for the moat) the confirmed-max main session.
- **Lifecycle:** ③ deep audit → RE-CERTIFY (or route findings out). Founder-close is a single path-scoped LOCAL
  commit (`compliance.ts` + the 2 test files + the slice-5 docs; **EXCLUDE `tools/page.tsx`**) bundled after ③;
  the commit message records the ③ outcome (SEAL STANDS / RE-CERTIFIED). `/push-go` is a separate explicit gate.
- **Defect classes in play:** DC-16 (claim-honesty census + set-based completeness), DC-11 (paths-only), DC-13
  (over-scrub guard — the bounded set), DC-14 (no functional `lower(email)` index; the stale snapshot F-A),
  DC-15 (docstring/comment sync), DC-17 (idempotent retries), DC-05/DC-10 (construction-pin gap §1.C). SEAM +
  LITERAL-EXECUTION standing.

## 5. ② evidence (what the seal established — so ③ doesn't re-derive it)
5 fresh-context lens-distinct Opus-4.8 reviewers (via Agent-tool spawns: L1 correctness/atomicity · L2
disclosure-honesty+scope · L3 SEAM · L4 literal-execution+test-fidelity at xhigh; L5 data-integrity MOAT at
`/effort max`) + the integrator's OWN source-level ground-truth. Established:
- **H1 — `UNIQUE(email)` collision UNREACHABLE:** uuid PK ⇒ distinct `deleted-<id>@…` strings; grep of every
  `db.insert(consumers)` site ⇒ none organically writes that literal ⇒ no collision against existing or
  prior-deletion rows. The decision-#1 "silent failed deletion" trap is not reachable.
- **H2 — F-2 auth-orphan complete** (set spans dev + every matching row's `supabaseUserId`, deduped, non-null).
- **H3 — F-4 over-delete guarded at the CAPTURE** (the `norm===''` ternary gates the SELECT; parameterized
  predicate; bounded set).
- **H4 — PII set-completeness vs over-scrub HOLDS** (full 9-FK consumer census; the set re-keys exactly the
  single-row tables, no more).
- **H5 — the flake is a TEST-RIG artifact, NOT erasure-path concurrency** (`processDataDeletion` has zero shared
  mutable state).
- **H6/H7 — atomicity/idempotency not worsened; accepted residuals are the only ones, not worsened.**
- **L4 mutation-tested EVERY test pin to RED** (per-row email; dual auth-set spans; inArray re-key; re-added
  ORDER BY; empty-email-guard-gates-CAPTURE; moat bare-await) — all bite, none vacuous.
- **Ground-truthed by the integrator:** 0 stale `consumerRecord`/`consumerForAuth`/`txSelectQueue` refs; all 6
  consumer `inArray` writes inside `if (consumerMatched)`; `api_keys` OR-gate = `toolIds.length>0 ||
  consumerMatched`; `deletedAuthUser` intact; `consumers.email` `notNull().unique()` raw + multi-NULL OK;
  `inArray([])`→`sql\`false\`` at drizzle 0.38.4. The ONLY open items are the §1.C construction-pin gap, the
  §1.D flake, and the §2 accepted residuals — all NON-BLOCKING.
- **Effort coverage note (carried):** the 4 xhigh reviewers self-reported `high` (introspection artifact —
  session WAS at xhigh, inheritance should carry it); L5 ran at the confirmed `/effort max` session. Recorded as
  a coverage note, not a gap; the convergence + L4's mutation-to-RED + L5's unreachability proof + the
  integrator's ground-truth support the seal.
