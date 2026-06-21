# V-N3-enable-disclosure — ③ POST-SEAL DEEP AUDIT record — 2026-06-20

> **Verdict: RE-CERTIFIED.** The SHIPPED CODE + TESTS seal STANDS unchanged (zero
> high/medium/low findings across 4 lens reviewers + a collective-miss critic; the
> mechanical gate re-derived clean). ONE companion-artifact defect was closed
> fix-first — the committed operator enable-runbook cited step 4 at the wrong source
> lines (`compliance.ts:704-708` → corrected to `:716-722`), a DC-15 recurrence the
> four code/test lenses structurally could not see (docs aren't under test) and that
> only the collective-miss critic found. Doc-only fix; no runtime/test change; gate
> stays 4740-green.

## High-stakes confirmation (one line)
✔ Confirmed HIGH-STAKES — the change is on the DC-16 **public-claim** surface (the
published `processDataDeletion` GDPR deletion-export disclosure, a legal/compliance
erasure claim). ③ is warranted on domain grounds even though the diff is comment-only
+ test pins. (Tier RE-CONFIRMED at ②, not escalated.)

## Base
② SEALED at LOCAL commit `c626db98` (parent `f84a942b`; `origin/main` = `bc7abc3e`;
NOT pushed). In-scope sealed artifact: `compliance.ts` (+20/0, comment-only),
`compliance-deletion-auth.test.ts` (+40/0), `compliance-honesty-regression.test.ts`
(+30/0), + the seal-record, handoff, and runbook gate-② correction.

## Mechanical pre-flight (clean run on the committed tree, handed to all reviewers)
- `npx tsc --noEmit` → **0 errors**.
- `npm run lint` → **0 errors** (pre-existing `<img>`/react-hooks warnings only).
- `npx vitest run` → **207 files / 4740 tests pass** (baseline 4736 + the 4 new pins).
- Byte-identity: `git show c626db98 -- compliance.ts` — every added line is a `*` or
  `//` comment; the user-facing `resultUrl` JSON is unchanged.
- Non-vacuity re-derived: the behavioral pin keys on the step-4 `toolId`-keyed
  `metadata:null` update — the unique intersection of `{vals.metadata===null}` ∩
  `{inArray[0]==='toolId'}` in `processDataDeletion` (conversion_events.metadata is
  consumerId-keyed; step 7b sets developerResponse; step 8 keys on `tools.id`).
- Env clean: `CLAUDE_CODE_FORK_SUBAGENT` / `CLAUDE_CODE_SUBAGENT_MODEL` /
  `CLAUDE_CODE_EFFORT_LEVEL` all UNSET.

## Orchestration / policy
- Operator opt-in (AskUserQuestion, answered): **Agent-tool spawns @ session xhigh**;
  optional `max` collective-miss bump **NOT taken** (run at xhigh). Recommended default
  taken — small comment-only diff under bypassPermissions moots the workflow loud-pause;
  the fan-out needs no mixed per-agent effort.
- Effort floor: session `effortLevel: xhigh` verified in BOTH `~/.claude-3/settings.json`
  and the project `/Users/lex/.claude/settings.json`; env override UNSET → the dial the
  subagents inherit is **xhigh**. The reviewers' self-reported "high" is the known
  Opus self-introspection unreliability (it reports the model default), not the actual
  dial — their depth (independent worktree reproductions, full proxy/schema traces) is
  consistent with xhigh. Floor MET.
- Allowlist: GREEN — reviewers needed only gate/repro Bash (`tsc`/`vitest`/`lint`/`git`,
  all in caps) + read tools; no MCP/WebFetch (pure source+test audit). No gap.
- 5 reviewers, each pinned `model: opus` (Claude Opus 4.8). Integrator triage, the
  fix-fold, and this verdict stayed in the main session.

## Lenses (coverage mode) and verdicts — scope = the INTEGRATED WHOLE on c626db98
1. **Correctness / latent-defect (integrated whole)** — CLEAN (0). Verified resultUrl
   byte-identity; disclosure gate (`toolIds.length>0`) is character-identical to step-4's
   guard; step 4 erases the payer for every disclosed state; NO reader of
   `invocations.metadata` after the null in-txn OR in the export (`collectDeveloperData`
   selects an explicit column list that EXCLUDES `metadata`); no cross-step interaction
   defect; idempotent re-run short-circuits at the `'completed'` guard. **Reproduced
   non-vacuity LIVE** in a throwaway worktree (re-key step 4 → only the behavioral pin
   goes RED; worktree removed, main tree byte-clean).
2. **Cross-chunk SEAM** — ALL 6 charges HOLD. Enumerated EVERY proxy invocation writer
   (recordProtocolInvocation `:1559`, recordMppInvocation `:1447`, drain `:2462`, x402,
   circle-nano, cached, failover) — every on-chain-payer field lands inside
   `invocations.metadata`, NOTHING in a sibling column. DC-23 drain `paymentId`
   (== raw EVM channel address) + `drainChannelId`/`drainNonce` erased by the whole-column
   null. Minimizer (`invocations-payer-min.ts`) only SUBTRACTS keys within the same column,
   writes the payer nowhere else; the deletion erasure is genuinely flag-independent.
   Schema = single `jsonb('metadata')` column; the docstring invents no column name
   (`external_ref` belongs to the ledger paragraph only). Export path does not re-expose
   metadata. No double-listing of the column across anonymized/retained/minimized.
3. **Literal-execution** — ALL 6 charges HOLD by value-trace. `invocations.toolId` ===
   the string `'toolId'` (schema mock); `inArray('toolId',['tool-1'])` ⇒
   `{inArray:['toolId',['tool-1']]}`; `isInArrayOn(pred,'toolId')` TRUE, uniquely
   discriminating step 4. Behavioral pin proven non-vacuous LIVE (delete step 4 →
   `expect(scrub).toBeDefined()` RED at `:996`, BEFORE the disclosure assertion; the
   disclosure-string clause + both source-text pins stay GREEN — exactly the vacuity the
   behavioral clause exists to catch). `completedResultUrl()` fails loud (returns null →
   `toContain` throws), never silent-passes. Honesty regions slice non-empty with unique,
   correctly-ordered markers. Negative-gate path holds. Mock faithful to real drizzle
   `update().set().where()` (DC-05).
4. **DC-16 honesty + full DC-01..DC-23 recurrence sweep** — CLEAN. Every new
   docstring/comment sentence TRUE vs schema + runtime; all 12 banned regexes hand-checked
   (uses the codebase verb "nulls", no `wiped|purged|erased` + `all|every tables`, no
   lawful-basis/exempt phrasing); resultUrl byte-identical; C1 placement satisfied (the
   `:878-884` comment contains NO `ledger_entries` and NO lawful-basis phrasing, so the
   existing `.not.toMatch(/ledger_entries/)` + legal-conclusion scans stay GREEN);
   `grep -c isInvocationsPayerMinimizeEnabled compliance.ts` = **0**; ledger disclosure
   object byte-unchanged. Per-class DC-01..DC-23 table: **NO recurrence** of any runtime/
   security class. DC-05 mock faithful; DC-11 path-string not a value; DC-15 diff matches
   handoff §3/§5/§7; DC-23 whole-column null erases the value-blind drain key.
5. **Collective-miss critic** (xhigh; `max` bump declined) — found the GAP the four lenses
   could not: see the finding below. Re-verified the EXCLUDED public FAQ (surface D,
   `docs/page.tsx`) makes no on-chain-payer claim → exclusion still honest; the
   `accountDeletedEmail` body makes no invocation/payer claim; no third test/source pins
   the disclosure inconsistently; the cross-chunk V-N3 seam is consistent.

## Finding — closed fix-first (the ONLY sustained finding)
**[DC-15 recurrence | confidence HIGH | severity LOW (operator-confidence, doc-only) | FIXED]**
The committed operator enable-runbook `v-n3-erasure-enable-runbook-2026-06-20.md` cited
`processDataDeletion` step 4 at `compliance.ts:704-708` in two places (`:37` gate-② "N/A"
justification + `:42` "no invocations disclosure blocker" callout). At the committed HEAD
`:704-708` is the **waitlist-signups DELETE**; the real step-4 invocations-`metadata`-null
is **`:716-722`**. WRONG ON ARRIVAL — the chunk's own +13-line docstring contrast paragraph
(added at `:395`) shifted step 4 down ~12 lines, but the pre-build citation (inherited from
handoff §0:22) was never re-derived. Operational bite: an operator running this IRREVERSIBLE,
counsel-gated prod flip who opens `:704-708` to verify the basis for SKIPPING the
deletion-export disclosure gate lands on unrelated code, eroding confidence in the exact
gate the runbook downgrades.

- **Why all four code/test lenses missed it:** docs aren't under test; the seal-record
  anchors step 4 SEMANTICALLY (cites only the disclosure array at the correct `:885`), so
  no lens cross-checked the runbook's numeric `:704-708`. Found ONLY by the collective-miss
  critic — a structural blind spot, recorded as such.
- **Fix (reproduced fails-then-passes before landing):** `sed` confirmed `:704-708` = the
  waitlist DELETE (FAIL against the claim) and `:716-722` = step 4's
  `.update(invocations).set({metadata:null}).where(inArray(invocations.toolId,toolIds))`
  (PASS). Replaced both runbook `:704-708` → `:716-722`. Doc-only; no test reads the
  runbook (`grep -rl` over `apps/web/src` = none) → gate unaffected, still 4740-green.
- **Handoff left as a pre-build snapshot (deliberate):** the handoff's line numbers
  (`:704-708`, `:865`, `:826-828`, `:571-576`, …) are uniformly PRE-build references that
  form an internally-consistent snapshot of the file the builder was handed; the literal
  step-4 code snippet quoted at §0:22 is correct and unambiguous. Rewriting a historical
  build spec's pointers post-hoc is revisionist — distinct from a forward-looking operator
  runbook, which must point at live code. Not touched.

## Defect-class ledger update
DC-15 (Plan/handoff/internal-contract drift) — **11th instance** recorded
(`.audit/defect-ledger/DC-15-plan-handoff-contract-drift.md` + INDEX count bumped). Mirrors
the (V-N2b)-③ `t-credited-at-runbook` drift (committed operator runbook found by the
SEAM+collective-miss critic, closed fix-first). Detection cue STRENGTHENED: a runbook/handoff
that cites MUTABLE source BY LINE NUMBER must be re-verified against the COMMITTED file — and
note the self-invalidation hazard: the very chunk that ADDS lines to a function silently
invalidates every `:NNN` citation in its OWN companion docs; prefer semantic anchors
(function + step name, a quoted snippet) over bare line ranges in forward-looking operator
docs. No new class; no SEAM/LITERAL-EXECUTION recurrence (both lenses clean).

## Frozen-surface integrity
`compliance.ts` runtime, the resultUrl JSON, the ledger disclosure object +
`minimizedNote`/`retainedUnscrubbedNote`, step-4 logic, `env.ts`, the minimizer module,
the proxy, the schema, the public FAQ, the every existing regression pin — all
byte-untouched. The pre-existing, dormant **F2** (BANNED_COMPREHENSIVE_SCRUB not run over
the resultUrl region) stays DEFERRED: all reviewers confirmed it is genuinely pre-existing,
not worsened, dormant (the actual `:878-884` comment is clean), and fixing it would perturb
the frozen honesty harness (out of scope per the charge).

## Working-tree state after this phase
- `M docs/tech-debt/v-n3-erasure-enable-runbook-2026-06-20.md` — the fix-first runbook
  citation correction (2 insertions / 2 deletions, git-tracked). **Uncommitted — Claude does
  not self-commit.** The operator may amend it into `c626db98` or land a follow-up commit at
  `/seal-go`/`/push-go` discretion.
- `.audit/defect-ledger/{DC-15,INDEX}.md` — ledger updates (local-only; `.audit/` is
  gitignored by design).
- `M apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` — EXCLUDED carry-forward (not
  this phase). `?? .claude/` — local-only.

## Verdict
**RE-CERTIFIED.** The shipped code + tests are air-tight, to-spec, and factually accurate —
all lenses clean, gate green, byte-identity and non-vacuity reproduced live. The single
companion-doc defect (DC-15 runbook citation drift) is closed fix-first under a
risk-proportionate doc-only re-review; the defect-class ledger is updated. No deferred work
pulled in; no frozen surface perturbed.
