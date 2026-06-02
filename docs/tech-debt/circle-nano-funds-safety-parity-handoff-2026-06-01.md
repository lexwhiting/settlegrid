# circle-nano funds-safety parity review — next-chunk handoff (2026-06-01)

> **You are picking up SettleGrid's settlement layer.** The x402 on-chain settlement chunk just
> shipped its seal-audit fixes and **PASSED an independent re-audit (verdict SEAL)** — committed
> LOCAL-ONLY, founder-gated go-live pending. THIS chunk investigates and fixes the **circle-nano**
> rail, which is **LIVE on Base mainnet** and **shares the exact code the x402 fixes touched**
> (`forwardAndBill` + `reconcile.ts`). The x402 audit flagged that the F1/F3/F4 class "very likely"
> applies to circle-nano too — but circle-nano's settle/billing topology is **architecturally
> different**, so this is a **trace-first funds-safety parity review, NOT a mechanical mirror** of the
> x402 fixes.
>
> **This chunk has a HARD precondition the founder added: a deep, independent PRE-BUILD audit of your
> BUILD PLAN (dynamic workflow / agent fan-out), with all its fixes applied, BEFORE you write any
> implementation code.** See §6. A POST-build funds-safety re-audit is also mandatory (§7), same as
> the x402 chunk. This is REAL MONEY — suggest `/effort max`.

---

## 0. Read first (in order), by ABSOLUTE path

1. **This doc.**
2. **`/Users/lex/settlegrid/docs/tech-debt/x402-seal-audit-fixes-2026-06-01.md`** — the x402 fix
   record: the **unifying invariant**, the exact F1/F3/F4 fixes with file:line, the runbooks, and the
   re-audit SEAL. **This is your reference implementation + the pattern to mirror WHERE it applies.**
3. **`/Users/lex/settlegrid/docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md`** — how
   circle-nano's on-chain settle was built (the `/api/circle-nano/settle` surface, the engine, the
   ground-truthed constants, the known DEFERRED gaps incl. "no reconciler credit", "unowned priced
   tool", "value vs cost").
4. **`/Users/lex/settlegrid/docs/tech-debt/x402-onchain-settlement-2026-05-31.md`** — the x402 chunk's
   build + the original "Seal-audit findings (2026-06-01)" (now marked re-audit-PASSED).
5. The canonical thread handoff in memory: `settlegrid-handoff-2026-05-31-x402-golive.md` (top banner =
   the x402 SEAL state + the carried circle-nano item).

Standing rules are restated inline in §8 so you're covered if a memory `[[link]]` doesn't resolve.

---

## 1. Mission + scope

**Determine, by tracing the LIVE circle-nano code, which funds-safety gaps actually exist on the
circle-nano rail, then fix them — surgically, mirroring the x402 patterns where the architecture
matches, and designing rail-appropriate fixes where it doesn't.**

The x402 audit's hypothesis (confirm or refute each against the real code):
- **F1 analog — replay double-credit:** does a replayed circle-nano authorization re-credit
  `developers.balanceCents` / `tools.totalRevenueCents`?
- **F3 analog — settle-then-fail / swallowed billing error / no loss alert** on an irreversible
  on-chain charge.
- **F4 analog — reconciler-confirmed settles never credit the dev:** **CONFIRMED present** — the B1.4
  reconciler's credit (`creditReconciledX402Settlement`) is `rail==='x402'`-gated, so circle-nano
  async-confirmed settlements flip `settled` but are **never credited** (`reconcile.ts`). This one is
  real regardless of the topology trace below.

⚠️ **Do NOT assume circle-nano == x402.** §4 documents the topology differences I verified this
session. Your build plan must rest on YOUR fresh trace, and the pre-build audit (§6) exists to verify
those factual assumptions before you build.

**Out of scope (do NOT do):** the x402 go-live (founder-gated; see the x402 docs), Task C (the
facilitator gas-budget circuit-breaker — a separate fast-follow), any auto-refund money path (new
irreversible movement — its own audit), and rewriting the x402 fixes or the circle-nano engine/verify
(byte-stable references).

---

## 2. Ground state + pre-flight (run before anything)

```sh
cd /Users/lex/settlegrid
git fetch --no-tags origin
git log -1 --oneline                    # expect: docs(...) circle-nano parity handoff  (the commit that adds THIS file)
git rev-list --count origin/main..HEAD  # expect 8 (the 7 x402-SEAL commits + this handoff commit), NOT pushed
git rev-parse --short origin/main       # expect cdd2d73a
git status --short                      # expect clean
git branch --list 'backup/*'            # backup/x402-seal-fixes-2026-06-01 @ 9c12c7f2 (the sealed x402 state)
cd apps/web && npx tsc --noEmit         # expect EXIT 0
```

- **Branch `main`** is the build base. It carries the **unpushed, founder-gated x402 SEAL** commits
  `a1962651` (the fixes) + `9c12c7f2` (F2 test + docs) + this handoff commit. **Do NOT rebase, amend,
  squash, or reorder those x402 commits** — they're sealed + reviewed; stack your circle-nano work on
  top. `backup/x402-seal-fixes-2026-06-01` preserves the sealed state if anything goes sideways.
- **What is LIVE in prod (`origin/main cdd2d73a`):** circle-nano on Base mainnet; x402 is the OLD
  structural-accept path but inert (`SETTLEGRID_PAYMENT_ADDRESS` unset). The x402 SEAL is NOT
  deployed. So your circle-nano fixes ride on top of the local x402 SEAL; the founder pushes the whole
  stack (or x402 first, then circle-nano). **Push + prod env are founder-gated — never you.**
- **The x402 fixes gave you reusable machinery on `main`:** `forwardAndBill` now accepts
  `options.skipCredit` (F1) and `options.irreversibleOnChain` (F3); `reconcile.ts` has the
  `creditReconciledX402Settlement` pattern + the `flipped && rail===...` gate; `orchestrate.ts` has the
  `alreadySettled` outcome flag. **If circle-nano needs the same fixes, prefer wiring it to this
  EXISTING machinery over duplicating it** (and extend the rail-gates rather than rewriting them).

---

## 3. Your chunk — the flow (TWO audits; pre-build is the new HARD gate)

0. **Pre-flight** (§2) + **Step-0 founder check:** before writing the build plan, surface any
   non-obvious scoping/topology decision to the founder (this user prefers a Step-0 confirm on
   money-path chunks).
1. **INVESTIGATE / TRACE.** Map circle-nano's full settlement + billing topology (§4 is your starting
   map — verify + complete it). Write your findings down (a short trace doc). Resolve every UNKNOWN in
   §4 against the actual code.
2. **BUILD PLAN.** From the verified trace, write a precise, **surgical/additive** build plan: which
   gaps are real, the exact changes (file:line), the test plan, any metadata/migration needs (e.g.
   storing `toolId` for a reconciler credit — mirror x402 F4), and an explicit list of your plan's
   **technical + factual assumptions** (the pre-build audit will verify these). Save it at
   `docs/tech-debt/circle-nano-funds-safety-build-plan-2026-06-01.md`.
3. **PRE-BUILD AUDIT (MANDATORY — §6).** Run the deep independent fan-out audit of the PLAN. Apply ALL
   `fix-before-build` findings to the plan; re-audit until the verdict is **PLAN-READY**. **Write zero
   implementation code until the plan-audit is clean.**
4. **IMPLEMENT** the audited plan, surgically. Leave proven/shared code byte-stable except the minimal
   additive wiring the plan specifies.
5. **POST-BUILD VERIFY** (§9 commands): `tsc` 0 · full `vitest` (baseline 4206 pass / 1 PRE-EXISTING
   fail `processDataDeletion`) · `eslint` 0 · `next build` 0. Rebuild the SDK + run the mcp suite ONLY
   if you touch `packages/mcp`. **Re-prove on Base Sepolia ONLY if you change the on-chain settle
   path** (recipe in the a2 doc / x402 docs; isolated SSL scratch Postgres — never prod DATABASE_URL).
6. **POST-BUILD AUDIT (MANDATORY — §7):** the 3-part chain + an independent fresh-context funds-safety
   panel (the green suite missed every x402 hole; it will miss these too). Fix any confirmed
   fix-before-go-live findings; re-audit until clean.
7. **COMMIT local-only** (path-scoped, founder-gated push). Update the x402/circle-nano docs + the
   memory handoff + MEMORY.md when the chunk seals.

---

## 4. Verified circle-nano topology (this session) + the UNKNOWNS to trace

**VERIFIED FACTS (grounded in grep/read this session — re-confirm, then build on):**
- **Proxy dispatch:** `route.ts:474-475` → `if (isCircleNanoEnabled() && isCircleNanoRequest(request))
  return handleProtocolProxy(request, slug, requestId, startTime, 'circle-nano')`. circle-nano uses the
  **generic `handleProtocolProxy`** (`route.ts:~1987`), which ends in `forwardAndBill` (`~2127`) — so
  **the proxy path credits `developers.balanceCents` via `forwardAndBill`.**
- **On-chain settle lives ELSEWHERE:** `executeCircleNanoSettlement` is called from **only one place —
  `apps/web/src/app/api/circle-nano/settle/route.ts:157`** (NOT from `handleProtocolProxy`). So the
  proxy billing path and the on-chain settle path are **different surfaces**.
- **The `/api/circle-nano/settle` route does NOT credit `developers.balanceCents`/`tools.totalRevenueCents`**
  (grep found no such write in that route) — it settles on-chain + writes the unified-ledger row only.
- **The reconciler is x402-only for credit:** `reconcile.ts` `creditReconciledX402Settlement` is gated
  `rail==='x402'`; `parseSettlementOperationId` already parses circle-nano opIds, and the settled-flip
  happens for circle-nano, but **no dev credit fires** for a reconciled circle-nano row.
- **circle-nano's `ensurePendingRow` (`circle-nano/settle.ts:75`) likely does NOT store `toolId`** in
  its metadata (grep showed `metadata:` at :91 with no `toolId`) — so an F4-style reconciler credit
  for circle-nano would need `toolId` stored (mirror x402 F4). **VERIFY by reading :75-110.**

**UNKNOWNS — you MUST resolve these before the build plan (they decide which gaps are real):**
1. **What does `handleProtocolProxy` actually do for circle-nano?** Read it end-to-end
   (`route.ts:~1987-2130`). Does it (a) validate a circle-nano credential and forward+credit WITHOUT
   any on-chain settlement, or (b) settle on-chain some other way? On what does it base the credit?
2. **How do the two surfaces relate?** Is `/api/proxy/[slug]` (circle-nano headers) the real
   per-invocation revenue path, while `/api/circle-nano/settle` is a separate facilitator-style
   endpoint? Does a proxy invocation require/trigger a prior `/settle`? **Where does the USDC actually
   move for a normal circle-nano tool call, and where is the dev credited for it?**
3. **Is the credit tied to an IRREVERSIBLE on-chain charge?** F1/F3 only bite when the dev is credited
   *after* an irreversible on-chain settlement. If the circle-nano proxy credits WITHOUT settling
   on-chain in-path, F1/F3 may not apply as in x402 — but a *different* gap may exist (e.g. crediting
   for a payment that never settled on-chain — the circle-nano analog of the OLD x402 structural-accept
   hole). Map this precisely.
4. **Replay behavior:** can the same circle-nano authorization be replayed to re-credit? Trace the
   idempotency (does the proxy path dedup? does `executeCircleNanoSettlement`'s idempotency interact
   with the proxy credit?).
5. **The `/settle`-settles-but-proxy-credits split:** if on-chain settlement (and its `pending`→`settled`
   ledger rows + the reconciler) lives on `/settle` while the credit lives on the proxy, then the F4
   "reconciler credits on flip" fix may be **mis-shaped for circle-nano** — there may be no in-request
   credit tied to the flip at all. Decide the correct circle-nano credit model with the founder
   (Step-0) before planning.

> **Honest note from the outgoing agent:** I verified the dispatch + that `forwardAndBill` credits +
> that `executeCircleNanoSettlement` is `/settle`-only + that the reconciler is x402-only. I did NOT
> trace `handleProtocolProxy`'s body or reconcile the two-surface split — that's your Step 1, and it
> may reveal the circle-nano gaps differ from x402's. Treat §4's hypotheses as leads, not gospel.

---

## 5. Reference patterns (mirror WHERE the architecture matches)

From `x402-seal-audit-fixes-2026-06-01.md` + the code on `main`:
- **The invariant:** *a credit fires exactly once, iff this actor flips the ledger row
  `pending→settled`* (`markSettlementSettled` = the sole guarded `WHERE settlement_status='pending'`
  UPDATE → one flip-winner). Proxy credits iff the orchestrator flipped (`alreadySettled` covers the
  idempotent-hit + concurrent-loser); the reconciler credits iff IT flipped → they can never both credit.
- **F1:** `X402SettlementOutcome.alreadySettled` on both non-winner returns (`orchestrate.ts`); proxy
  passes `forwardAndBill(..., { skipCredit: true })` on a replay → forwards but does NOT re-credit.
- **F2 (x402-specific, likely N/A to circle-nano):** prod network hard-pin. circle-nano's verifier
  already rejects non-Base; check whether a prod mainnet-only pin is warranted for circle-nano too.
- **F3:** `forwardAndBill(..., { irreversibleOnChain: true })` on a fresh on-chain settle → distinct
  alerts (`proxy.onchain_settled_upstream_failed`, `proxy.onchain_credit_lost_after_settle`) + stop
  swallowing the billing-UPDATE error. NO auto-refund.
- **F4:** reconciler credits dev+tool on its own flip, `rail`-gated; `toolId` stored in the pending-row
  metadata. **To extend to circle-nano: store `toolId` in circle-nano's `ensurePendingRow` + widen the
  reconciler credit gate to include `'circle-nano'` (only after the trace confirms the credit model).**

Key reference code on `main`: `apps/web/src/app/api/proxy/[slug]/route.ts` (`handleX402Proxy`,
`forwardAndBill` with its `options`), `apps/web/src/lib/settlement/x402/orchestrate.ts` (`alreadySettled`),
`apps/web/src/lib/settlement/reconcile.ts` (`creditReconciledX402Settlement`),
`apps/web/src/lib/settlement/ledger.ts` (`markSettlementSettled`, `recordSettlementEntry`).

---

## 6. PRE-BUILD AUDIT (the founder's HARD gate) — design + runnable workflow

**Requirement:** before ANY implementation, run a deep, independent, fresh-context audit of your
written BUILD PLAN via a dynamic workflow / agent fan-out. It must verify the plan is **comprehensive,
high-quality, to-spec, that every technical + factual assumption is correct (checked against the actual
code, not assumed), and that it is as error-free as possible.** Apply all `fix-before-build` findings to
the plan and re-audit until **PLAN-READY**. **No code before the plan-audit is clean.**

**Over-auditing regression guard (bake into the synthesis spine — load-bearing):** the audit REPORTS;
it does not inflate the plan. Classify every plan-finding `fix-before-build` /
`improve-if-cheap` / `out-of-scope`. Only **high-confidence completeness, correctness, factual-assumption,
or funds-safety** defects gate the plan. Do NOT let volume, doc-nits, style, or speculative
gold-plating raise the verdict; do NOT recommend rewriting proven/shared code or adding new
money-movement; do NOT let the audit balloon the plan's scope. Under-scoping (a missed real gap) AND
over-scoping (unnecessary churn) are BOTH plan defects.

This mirrors the post-build seal-audit I ran this session (4 finders × 2-lens adversarial verify ×
guarded synthesis). A structural template of that script existed at
`…/workflows/scripts/x402-seal-audit-reaudit-wf_cbcb980c-675.js` (session-scoped — may be gone; the
script below is self-contained). Save the script below, then run:
`Workflow({ scriptPath: "<saved path>", args: { planPath: "docs/tech-debt/circle-nano-funds-safety-build-plan-2026-06-01.md" } })`.
Multi-agent orchestration is EXPLICIT opt-in — this handoff is your opt-in for this audit.

```js
export const meta = {
  name: 'circle-nano-prebuild-plan-audit',
  description: 'Pre-build audit of the circle-nano funds-safety build plan (verify before building)',
  phases: [
    { title: 'Find', detail: '4 fresh-context lenses over the build plan vs the real code' },
    { title: 'Verify', detail: '2-lens adversarial refutation per fix-before-build candidate' },
    { title: 'Synthesize', detail: 'guarded verdict — only real completeness/correctness/assumption defects gate' },
  ],
}

const REPO = '/Users/lex/settlegrid'
const PLAN = (args && args.planPath) || 'docs/tech-debt/circle-nano-funds-safety-build-plan-2026-06-01.md'

const COMMON = `You are running a PRE-BUILD audit of a BUILD PLAN for the SettleGrid circle-nano rail
(${REPO}) — REAL MONEY. The plan has NOT been implemented yet; you are auditing the PLAN, not code.

READ THE PLAN:  cd ${REPO} && cat ${PLAN}
VERIFY ITS CLAIMS against the ACTUAL code (read the files; do not trust the plan's assertions):
  - apps/web/src/app/api/proxy/[slug]/route.ts        (handleProtocolProxy ~1987, the circle-nano dispatch ~474, forwardAndBill + its options)
  - apps/web/src/app/api/circle-nano/settle/route.ts  (executeCircleNanoSettlement call site ~157; does it credit?)
  - apps/web/src/lib/settlement/circle-nano/{settle,settle-engine,verify}.ts
  - apps/web/src/lib/settlement/reconcile.ts          (creditReconciledX402Settlement is rail==='x402'-gated)
  - apps/web/src/lib/settlement/ledger.ts             (markSettlementSettled flip guard; recordSettlementEntry)
REFERENCE (the proven x402 fixes the plan may mirror): docs/tech-debt/x402-seal-audit-fixes-2026-06-01.md.

THE INVARIANT any credit fix must preserve: a credit fires EXACTLY ONCE, iff this actor flips the
ledger row pending->settled (a single guarded UPDATE ... WHERE settlement_status='pending').

OVER-AUDITING GUARD (binding): classify each finding fix-before-build | improve-if-cheap | out-of-scope.
Only HIGH-confidence completeness / correctness / factual-assumption / funds-safety defects gate the
plan. Do NOT inflate with style, doc-nits, speculation, or scope-creep; do NOT recommend rewriting the
proven x402 fixes or the circle-nano engine/verify, or adding new money-movement (auto-refund). Flag
BOTH under-scoping (a real gap the plan misses) and over-scoping (unnecessary churn).`

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['findings'],
  properties: { findings: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['title','severity','confidence','actionClass','description','evidence'],
    properties: {
      title: { type: 'string' }, planSection: { type: 'string' }, file: { type: 'string' },
      severity: { enum: ['CRITICAL','HIGH','MEDIUM','LOW','INFO'] },
      confidence: { enum: ['high','medium','low'] },
      actionClass: { enum: ['fix-before-build','improve-if-cheap','out-of-scope','not-an-issue'] },
      description: { type: 'string' }, evidence: { type: 'string' },
    },
  } } },
}
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['refuted','isPlanGating','confidence','recommendedClass','reasoning'],
  properties: {
    refuted: { type: 'boolean' }, isPlanGating: { type: 'boolean' },
    confidence: { enum: ['high','medium','low'] },
    recommendedClass: { enum: ['fix-before-build','improve-if-cheap','out-of-scope','not-an-issue'] },
    reasoning: { type: 'string' },
  },
}
const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict','blocking','improvements','outOfScope','summary'],
  properties: {
    verdict: { enum: ['PLAN_READY','PLAN_NEEDS_FIXES','PLAN_NOT_READY'] },
    blocking: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    outOfScope: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const LENSES = [
  { key: 'factual-assumptions', prompt: `LENS A — FACTUAL / TECHNICAL ASSUMPTIONS. Extract EVERY technical/factual claim the plan relies on (e.g. "handleProtocolProxy forwards without on-chain settle", "the /settle route does/doesn't credit", "circle-nano rows lack toolId", "forwardAndBill's options are reusable", "the reconciler is x402-only"). VERIFY each against the actual code. Flag any claim that is false, unverified, or imprecise — a plan built on a wrong assumption builds the wrong fix.` },
  { key: 'completeness', prompt: `LENS B — COMPLETENESS. Independently trace circle-nano's settle + billing topology (both surfaces: the proxy/handleProtocolProxy path AND /api/circle-nano/settle, plus the reconciler + any facilitator surface). Does the plan cover ALL real funds-safety gaps? What paths/edge-cases/replay-interleavings does it MISS? Is any genuine gap (e.g. credit-without-on-chain-settle, reconciler-no-credit, settle-then-fail) left unaddressed?` },
  { key: 'correctness-invariant', prompt: `LENS C — CORRECTNESS / TO-SPEC / INVARIANT. Will the planned changes actually CLOSE the gaps without introducing new ones? Does each credit change preserve "credit exactly once iff this actor flips pending->settled"? Any race, wrong-rail-gate, double-credit, or credit-without-settle the DESIGN would create? Does it correctly reuse the x402 machinery (skipCredit / irreversibleOnChain / reconciler credit) rather than diverging?` },
  { key: 'scope-regression', prompt: `LENS D — SCOPE / REGRESSION / ADDITIVITY. Is the plan additive/surgical? Does it avoid rewriting the proven x402 fixes + the circle-nano engine/verify (must stay byte-stable)? Does it avoid new money-movement (auto-refund)? Is it neither OVER-scoped (gold-plating, needless churn, touching unrelated rails) nor UNDER-scoped? Are migrations/metadata (e.g. toolId storage) correctly identified + hand-applied-SQL-aware? Are the planned tests real (drive the actual path, not over-mocked)?` },
]

function verifyPrompt(f, lens) {
  const card = `TITLE: ${f.title}\nPLAN SECTION: ${f.planSection || ''}  FILE: ${f.file || ''}\nSEVERITY: ${f.severity}  CONFIDENCE: ${f.confidence}  CLASS: ${f.actionClass}\nDESCRIPTION: ${f.description}\nEVIDENCE: ${f.evidence}`
  if (lens === 'reality') return `ADVERSARIAL VERIFY — lens: REALITY. A plan-finder reported:\n\n${card}\n\nTry HARD to REFUTE it. Read the actual code + the plan. Is this a genuine plan defect that would cause a wrong/incomplete/buggy build, or a false alarm / nit / out-of-scope? Default refuted=true unless you can concretely show the defect. Set isPlanGating + recommend a class.`
  return `ADVERSARIAL VERIFY — lens: IMPACT. Same finding:\n\n${card}\n\nIf the plan ships AS-IS with this unaddressed, does it produce an incomplete or INCORRECT (funds-unsafe) build? Trace the concrete consequence. If the build would still be correct + complete, refute it. Default refuted=true unless you can show real build impact. Set isPlanGating + recommend a class.`
}

phase('Find')
log(`Pre-build audit of ${PLAN}`)
const finderResults = await parallel(LENSES.map((l) => () =>
  agent(`${COMMON}\n\n${l.prompt}`, { label: `find:${l.key}`, phase: 'Find', schema: FINDINGS_SCHEMA })))
const all = finderResults.flatMap((r, i) => (r && Array.isArray(r.findings) ? r.findings.map((x) => ({ ...x, lens: LENSES[i].key })) : []))
const cands = []
const seen = new Set()
for (const c of all.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH' || f.actionClass === 'fix-before-build')) {
  const k = `${(c.title || '').slice(0, 50).toLowerCase()}`
  if (!seen.has(k)) { seen.add(k); cands.push(c) }
}
log(`${all.length} plan-findings; ${cands.length} fix-before-build/HIGH+ candidates to verify`)

phase('Verify')
const verified = await parallel(cands.map((c) => () =>
  parallel(['reality', 'impact'].map((lens) => () =>
    agent(`${COMMON}\n\n${verifyPrompt(c, lens)}`, { label: `verify:${lens}:${(c.title || '').slice(0, 20)}`, phase: 'Verify', schema: VERIFY_SCHEMA })))
    .then((vs) => ({ finding: c, verdicts: vs.filter(Boolean) }))))

phase('Synthesize')
const verdict = await agent(`${COMMON}\n\nSYNTHESIS. Below are ALL plan-findings + the adversarial verdicts for the candidates. Apply the OVER-AUDITING GUARD strictly. A finding gates the plan ONLY if it is a HIGH-confidence completeness/correctness/factual-assumption/funds-safety defect, classed fix-before-build, that survived verification (not refuted by both verifiers). VERDICT: PLAN_READY (no blocking — implement), PLAN_NEEDS_FIXES (a concrete fix-before-build list), PLAN_NOT_READY (fundamentally incomplete/wrong — re-plan).\n\nALL FINDINGS:\n${JSON.stringify(all, null, 1)}\n\nVERIFIED CANDIDATES:\n${JSON.stringify(verified.filter(Boolean), null, 1)}\n\nReturn blocking[] (fix-before-build items to apply to the plan), improvements[] (cheap optional), outOfScope[], and a tight summary.`,
  { label: 'synthesize-plan-verdict', phase: 'Synthesize', schema: SYNTH_SCHEMA })

return { verdict, totalFindings: all.length, candidates: cands.length, allFindings: all, verified: verified.filter(Boolean) }
```

After the run: apply every `blocking` item to the plan doc, re-run the audit (it caches unchanged
agents on `resumeFromRunId`), and only proceed to implementation at **PLAN_READY**.

---

## 7. POST-BUILD audit + verification (mandatory, same as x402)

After implementation + green gates, run the 3-part audit chain + an **independent fresh-context
funds-safety panel** over the IMPLEMENTED diff (the green suite missed every x402 hole). Reuse the
post-build audit shape from this session (finders over funds-safety dimensions × 2-lens adversarial
verify × guarded synthesis with the over-auditing guard). Verdict must be SEAL (0 blocking) before the
chunk is sealed. Re-prove on Base Sepolia **iff you changed the on-chain settle path.**

---

## 8. Standing rules / guardrails (load-bearing)

- **Push + prod env are founder-gated** — never `git push`, never set/change Vercel prod env. The
  founder controls both the x402 go-live and any circle-nano deploy. [[feedback-push-policy]]
- **Mandatory independent audit** for any money-path change — BOTH the pre-build plan audit (§6) AND
  the post-build funds-safety panel (§7). The green suite WILL miss real funds bugs.
  [[feedback-ke2-independent-audit-mandatory]]
- **Over-auditing regression guard** (§6) on every audit spine: additive/surgical only; leave proven
  code byte-stable; classify findings; only high-confidence funds-safety/correctness/completeness
  gates; document tradeoffs instead of churning.
- **npm** not pnpm; vitest node-env; **viem is apps/web only** (`packages/mcp` is zero-crypto) —
  rebuild the SDK (`cd packages/mcp && npm run build`) after ANY `packages/mcp` change.
- **Path-scoped commits** (`git add -- <explicit paths>`); **quote bracketed dirs**
  (`"apps/web/src/app/api/proxy/[slug]/route.ts"`); re-verify branch+HEAD before committing; **do NOT
  touch the x402 SEAL commits**. `git config user.name` is UNSET → commit with
  `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com" commit …`; trailer
  `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>` (current pin: `Claude Opus 4.8 (1M context)`).
- **`apps/web/.env.local` DATABASE_URL is PRODUCTION** — never point test writes at it. Any on-chain
  e2e uses an ISOLATED SSL scratch Postgres (the app `db` forces TLS); apply BOTH
  `drizzle/0005_unified_ledger.sql` + `drizzle/0006_ledger_authorization_fields.sql`. Migrations are
  hand-applied SQL via the Supabase SQL Editor (the drizzle journal is intentionally incomplete) — if
  the plan adds a column, document the manual migration; prefer JSONB metadata (no migration) where
  the x402 F4 fix did (it stored `toolId` in metadata).
- **Mask-the-exit trap:** never `cmd | tail` to judge success — use `> log 2>&1; echo $?` then grep.
- **Context-degradation standing order:** warn the founder the moment degradation risks implementation
  quality. [[feedback-context-degradation-alert]]
- Don't touch `apps/web/src/lib/rate-limit.ts` (mock it in tests if needed).

## 9. Verification commands (the green ones)

```sh
cd /Users/lex/settlegrid/apps/web && npx tsc --noEmit                 # EXIT 0
npx vitest run                       # baseline 4206 pass / 1 PRE-EXISTING fail (settlement-moat > processDataDeletion). Run the FULL suite.
npx eslint <changed files>           # 0
npx next build                       # EXIT 0 (before any push). NOTE: route.ts (route files) may ONLY export the HTTP verbs + Next config — exporting a helper FAILS the build (this bit the x402 chunk; test handlers via the exported POST instead).
cd /Users/lex/settlegrid/packages/mcp && npm run build && npx tsc --noEmit && npx vitest run   # ONLY if you edit packages/mcp (then rebuild the SDK)
```

## 10. Carried debt + deferred (full register in the x402 fix doc)

- **circle-nano F1/F3/F4 parity = THIS chunk.**
- circle-nano carried (a2 doc): unowned-priced-tool settles-without-collecting; `value` vs `costCents`
  divergence; `takeBps:0`; `accountId = developerId` stand-in (accounts unprovisioned).
- The pre-existing reverted+nonce-consumed dropped-credit edge (a stranded `pending` row for a
  concurrent double-settle — same single on-chain payment; byte-identical in the x402 HEAD~1). Revisit
  at the mainnet-cutover hardening.
- F6 (x402): `verifyLedgerIntegrity` reports `balanced:false` once single-sided settlement rows exist
  (already live via circle-nano) — reporting artifact, operator runbook in the x402 fix doc; the proper
  fix (the `settlement_status IS NULL` filter + a per-dev detective job) is deferred.
- Task C: facilitator gas-budget circuit-breaker (separate fast-follow).
- x402 go-live (Task B): founder-gated; not this chunk.
