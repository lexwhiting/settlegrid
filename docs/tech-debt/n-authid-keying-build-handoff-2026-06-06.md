# (N) auth.id rate-limit keying — BUILD handoff (2026-06-06, pre-build gate PASSED)

> **Self-contained handoff for a FRESH session. Read this end-to-end before touching anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a verification
> facilitator) → suggest `/effort max`.
>
> **Where things stand:** Step-0 (founder picked the chunk), the full trace, the build plan, AND the
> deep independent **pre-build audit are ALL DONE — verdict PLAN_READY (0 blocking), round 1 → fixes →
> round 2.** Do NOT redo any of them. **Your job is the BUILD:** single-writer implementation → machine
> gates → MANDATORY post-build Workflow panel + certification (0 blocking) → founder-gated LOCAL commit
> → close-out. Implementation has NOT started: zero production-code edits exist at HEAD.

---

## 0. Read order
1. **THIS doc, end-to-end.**
2. **THE PLAN — the canonical build spec (COMMITTED `7cb4045d`, status v2 FINAL / PLAN_READY):**
   `docs/tech-debt/n-authid-rate-limit-keying-build-plan-2026-06-05.md`. Read ALL of it; the
   load-bearing sections are §3 (census: 95 files / 122 sites, the health EXCLUSION), §4 (design rules
   R1–R8 — what to insert, where, per class), §5 (behavioral deltas), §6 (tests T1–T6 + the
   zero-forced-edit evidence), §7 (machine gates G1–G6), §8 (SCOPE GUARD — binds the build AND both
   post-build gates), §9 (rollout), Appendix A (the 95-file checklist).
3. `.audit/n-prebuild/CHECKPOINT.md` (gitignored, on disk) — recovery procedures: usage-limit /
   session-death / mid-sweep interruption / degraded-Workflow-run guard.
4. `.audit/n-prebuild/round{1,2}-verdict.txt` — what the audit proved and fixed (R1: 2 tsc-proven
   blockers; R2: PLAN_READY, FIX-A execution-proven, FIX-B exhaustively proven).
5. (Posture, skim) `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md` — the DEBT register; this
   chunk closes **#1c**, the last open part of HIGH-severity DEBT #1.

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = the commit of THIS handoff (the tip)** =
  origin/main `9d22fd2e` **+4 doc-only commits**: `d1b0297f` (capstone fix), `9b4dfb56` (post-M
  handoff), `7cb4045d` (the plan), + this handoff. Working tree clean. **DO NOT PUSH** (founder-gated;
  pushes trigger Vercel builds). Confirm:
  `git -C /Users/lex/settlegrid status -sb && git log -5 --oneline && git rev-parse origin/main`.
- **LIVE prod (do NOT regress):** x402 proxy + circle-nano kernel settle USDC to
  `0xdcefe0094755ae37395198488f057daa6e430724`; ap2 LIVE as a verification facilitator.
- **Baselines — re-run BOTH first; all GREEN at this HEAD → ANY red is YOURS:**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4250 pass / 0 fail / 179 files**) ·
    `npx next build` (**0**; NOT concurrent with tsc — they race on `.next/types`) · eslint runs on
    changed files post-build (2 pre-existing `unused-eslint-disable` warnings in
    cron/crawl-{registry,services} are NOT yours).
  - `cd packages/mcp`: `npx vitest run` (**1896 pass / 1 skip**).
  - One PRE-EXISTING transient flake was once seen in `tools.test.ts` (leaked db-mock rejection) — if a
    transient red appears, re-run before assuming it's yours.
- **Shell is zsh:** `cd` persists across Bash calls; quote bracketed paths (`'…/[id]/…'`, `'…/[slug]/…'`).
  npm (NOT pnpm). Migrations: none in this chunk; applying anything is founder-gated regardless.

## 2. DECIDED + AUDIT-SETTLED — do NOT redo or re-litigate (reopening needs a concrete NEW trace)
- **Step-0 (founder, 2026-06-05):** chunk = **(N)**; **D1** scope = session-auth routes ONLY
  (settlement rails `sessions/* x402/* ap2/* circle-nano/* outcomes/* settlements/*`, SDK paths
  `sdk/*`, `proxy/[slug]`, `cron/*` are OUT); **D2** the per-user layer REUSES each handler's existing
  limiter — no new limiter, no new export, no new tunable number.
- **Pre-build audit chain:** R1 `wf_2e9f3da8-3bc` PLAN_NEEDS_FIXES (20 agents; blockers: the mfa
  hoist-less try; `tools/[id]/health` optional-auth misclassification) → ALL fixes applied → R2
  `wf_c31c609b-9c8` **PLAN_READY (0 blocking)**, degraded-run guard passed. Verdicts on disk (§0.4).
- **Audit-settled (the §8 SCOPE GUARD enforces these):** the `tools/[id]/health` EXCLUSION (sole
  optional-auth site; uid layer there would be anonymous-bypassable); two-layer design (keep pre-auth
  IP limit + ADD post-auth uid limit); same-limiter reuse (Upstash keys independent windows per
  identifier); per-handler buckets; 429 byte-mirroring (R5); fail-open default (H1); the Vercel
  XFF-overwrite trust model (M/H1); deferrals F1 (NAT-fairness IP raise), F2 (`sdk/meter`
  body.consumerId observation — settlement surface, separate chunk), F3 (dead `requireApiKey` export).
- **Byte-stable (do not touch):** `lib/rate-limit.ts`, `lib/middleware/auth.ts`, the ENTIRE settlement
  spine (`lib/settlement/**`, orchestrators, engines, writer call sites, take model, B4 semantics,
  `developers.balanceCents` authority), all D1-excluded routes, every identifier PREFIX, every limiter
  number, every 429 message, `packages/mcp`, the 9 `ipAddress: … ?? undefined` audit captures.

## 3. THE BUILD — single-writer sweep (the plan §4/§9 govern; this is the tactical order)
**What:** at each of the 122 guard sites across the 95 Appendix-A files, insert the uid block (plan R1):
```ts
const userRl = await checkRateLimit(<sameLimiter>, `<samePrefix>:uid:${<authVar>.id}`)
if (!userRl.success) {
  return <byte-identical args to the handler's existing IP-layer 429 return>
}
```
PURE INSERTION everywhere except the one X1 line (below). For EVERY site: read the handler's auth block
+ its IP-layer block first; reuse the SAME limiter, the SAME prefix (the literal segment(s) up to the
colon before the first `${…}` interpolation), and byte-mirror the SAME 429 response args (helper,
message, status, code, requestId presence).

**ORDER — front-load the 16 special-attention sites FIRST (strongest context), then the uniform bulk:**
| # | Class | Site(s) | The nuance (plan R4) |
|---|-------|---------|----------------------|
| 1 | X1 ×1 | `auth/mfa/route.ts` POST :66-70 | NO hoisted `let auth`: INSERT `let auth` before the try; CHANGE :67 → `auth = await requireDeveloper(request)` (the chunk's ONLY modified line); then standard insert after the try/catch. mfa's other 3 sites are plain V1a. |
| 2 | V3 ×1 | `admin/signup-followup/route.ts` local `requireAdmin` :89-116 | Insert INSIDE the helper after the auth try/catch succeeds, BEFORE the `ADMIN_EMAILS` check; use its `{ok:false, response}` return shape. One insert covers GET+POST. |
| 3 | V4 ×1 | `tools/publish/route.ts` PUT (auth call :214) | Insert after the auth try/catch (:212-220), before `parseBody`; its `errorResponse` takes `requestId` as 4th arg — mirror it. |
| 4 | V2 ×7 | `orgs/route.ts`, `orgs/[id]/route.ts` ×2, `orgs/[id]/members/route.ts` ×2, `orgs/[id]/members/[userId]/route.ts`, `orgs/[id]/allocations/route.ts` | Auth already runs FIRST there; insert AFTER the existing post-auth IP-rl block (keep it contiguous). |
| 5 | V1b ×4 | `consumer/schedules/route.ts` :99,:139 · `consumer/schedules/[id]/route.ts` :24,:71 | Bare guard (`const consumer = await requireConsumer(request)`, no dedicated try/catch — throws to outer catch). Insert immediately after the guard line. |
| 6 | V1a-split ×2 | `admin/chargeback-watch/unpause/route.ts` :49 (`chargeback-unpause:`) · `payouts/schedule/route.ts` :84 (`payout-schedule:`) | Their IP identifiers interpolate `${ip.split(',')[0]…}` — the PREFIX is still the literal before the first `${`; keep their IP lines byte-identical. |

**Then the uniform V1a bulk (~106 remaining sites)** by plan §9.1 directory batches: admin →
audit-log/auth → billing → consumer → dashboard → developer → payouts/proxy-stats/stripe → templates →
tools. (orgs is already done in #4.) V1a recipe: first statement after the auth `try/catch`.

**Per batch:** `npx tsc --noEmit` spot-check + inventory. **Mid-sweep inventory at any time** (also the
crash-resume mechanism): `rg -o ':uid:\$\{' apps/web/src/app/api -g 'route.ts' | wc -l` (target 122)
and per-file presence vs Appendix A (which files still lack a `:uid:` match).

## 4. Tests + suites (plan §6 is canonical)
- **ZERO forced edits to existing tests** — audit-proven (all 43 once-mocks are `success:false`; zero
  call-count/Nth assertions on `checkRateLimit`; `toHaveBeenCalledWith` asserts are additive-safe).
  If an existing test goes red, you deviated from the recipe — fix the code, not the test.
- **+6 new tests T1–T6** (plan §6): per-class 2nd-call-429 + Nth-key assertions, plus the T6 negative
  (failed auth ⇒ exactly ONE `checkRateLimit` call). **T5 (mfa) goes in a NEW
  `n-uid-rate-limit.test.ts`** (mfa has no existing test file); the others go in each route's existing
  test file. Every mock must expose what the route imports (the M test-mock lesson).
- **End state:** apps/web **4256 pass / 0 fail** · tsc **0** · `npx eslint <changed>` **0 errors** ·
  next build **0**; packages/mcp UNTOUCHED **1896/1**.

## 5. Machine gates G1–G6 (plan §7 — ALL must pass before the panel)
G1 `:uid:` count == 122 · G2 every Appendix-A file ≥1, every non-census `route.ts` == 0 (incl.
`tools/[id]/health`) · G3 diff confined to {95 census files} ∪ {tests} ∪ {docs}, with the §2 byte-stable
surfaces ABSENT · G4 numstat: deletions 0 ×94 files + `auth/mfa/route.ts` exactly 1 · G5 `userRl` count
== 122, all in Appendix-A files · G6 full suites at §4 end state.

## 6. POST-BUILD gate — MANDATORY, 0 blocking BEFORE any commit (founder doctrine)
A green suite is NOT sufficient. Run a deep independent **Workflow fan-out** (do NOT hand-audit) —
adapt `.audit/m-postbuild/security-panel.mjs` → `.audit/n-postbuild/security-panel.mjs` (same shape:
fresh-context lenses that RE-DERIVE against the actual diff → adversarial verify, default-refuted →
guarded synthesis at PASS / 0 blocking):
- **Lenses:** (a) insert-only-diff (machine-anchor on G4/G3 output — every production hunk is exactly a
  uid block + the X1 hoist/capture); (b) spine-adjacency over the money-adjacent census files (payouts
  ×3, billing ×5, stripe/connect, templates/purchase, consumer/credit-packs ×2, tools/publish, PLUS
  orgs/* and dashboard/developer/data-export/* per the R2-audit belt-and-suspenders) — each hunk
  byte-exact, no settle/verify/dispatch logic in reach; (c) key/limiter correctness (prefix + limiter +
  429 mirror fidelity per site vs the plan's R2/R3/R5); (d) test-integrity (T1–T6 assert what they
  claim; no existing assertion weakened). **Embed the plan §8 over-auditing/SCOPE GUARD verbatim** —
  zero findings is a valid outcome; scope-growth findings are `rejected-scope-expansion`.
- Then the **certification pass** (adapt `.audit/m-certify/certify.mjs`) — the founder's standard
  before declaring a chunk done.
- **Transient-death recovery:** if a subagent dies "without calling StructuredOutput", resume:
  `Workflow({scriptPath, resumeFromRunId})` — cached agents return (proven this chunk: R2 died once,
  resume completed for ~285k tokens vs a full re-run). **Degraded-run guard:** before trusting ANY
  verdict, check the logs line shows ALL lenses produced and no null verify-verdicts (a dead lens
  silently yields zero findings). Details: `.audit/n-prebuild/CHECKPOINT.md`.
- Record verdicts to `.audit/n-postbuild/…verdict.txt` (+ certification record).

## 7. Founder-gated close-out (NOTHING ships without the founder's word)
1. **LOCAL commit, path-scoped, atomic** (shared-worktree hazard — never `git add -A`):
   `git add <paths> && git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com"
   commit -m "<msg>" -- <paths>` (quote `[id]`/`[slug]` paths), trailer
   `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`. **NO push.**
2. **Capstone:** `docs/tech-debt/n-authid-keying-resolution-2026-06-06.md` — what shipped, the audit
   chain (R1→R2 + panel + cert verdicts), the honest value framing (fixes distributed-authed-abuser
   evasion + per-user accountability; does NOT fix NAT collective throttling — F1), F1/F2/F3 dispositions.
3. **DEBT register** (`publisher-api-keys-audit-2026-05-28.md`): mark **#1c CLOSED** → DEBT #1 (HIGH)
   fully closed (a: H1, b: M, c: N); append F1/F2/F3 as new tracked items.
4. **Next-chunk handoff** (Step-0-gated, post-N): carry the candidate menu from
   `docs/tech-debt/next-chunk-handoff-2026-06-05-post-m.md` §2 minus (N) — (K) HMAC-pepper is the
   natural lead candidate, (C) revenueSharePct hygiene, (A) ACP BD-gated, (H) hop demand-gated —
   re-verify every line; they drift.
5. **Memory note:** memory is per-account (`CLAUDE_CONFIG_DIR`) — the REPO docs are canonical; update
   whatever account's memory you run under, pointing at the capstone, and mark the in-flight
   checkpoint memory (account-1 `settlegrid-n-chunk-checkpoint.md`) superseded if reachable.

## 8. Guardrails (real money — non-negotiable)
- **Single-writer core.** Fan-out is for the post-build panel + certification ONLY — NEVER to mutate
  files in parallel.
- **Ground every conclusion in ACTUAL tool output** (greps/gates over green-suite vibes).
- **Line-surgical insert-only** (R6); byte-stable surfaces per §2; the plan §8 SCOPE GUARD governs all
  decisions — when in doubt, the smaller change wins.
- Do NOT push, set/change prod env, or apply migrations. Demo sandbox must never reach a real settle.
- **Flag context degradation the moment it risks quality** (founder standing order). If the sweep
  outgrows your context: stop at a batch boundary, run the §3 inventory, update
  `.audit/n-prebuild/CHECKPOINT.md`, and recommend a continuation session — partial state is safe by
  construction (per-file-atomic inserts + G-gate inventory).

## 9. File-path index (absolute)
- **This handoff:** `/Users/lex/settlegrid/docs/tech-debt/n-authid-keying-build-handoff-2026-06-06.md`
- **THE PLAN (canonical):** `/Users/lex/settlegrid/docs/tech-debt/n-authid-rate-limit-keying-build-plan-2026-06-05.md`
- **Recovery checkpoint:** `/Users/lex/settlegrid/.audit/n-prebuild/CHECKPOINT.md`
- **Audit verdicts:** `/Users/lex/settlegrid/.audit/n-prebuild/round{1,2}-verdict.txt` (+ the audit
  script `prebuild-audit.mjs` for the Workflow shape to mirror)
- **Post-build templates to adapt:** `/Users/lex/settlegrid/.audit/m-postbuild/security-panel.mjs` ·
  `/Users/lex/settlegrid/.audit/m-certify/certify.mjs`
- **Rate-limit source of truth:** `apps/web/src/lib/rate-limit.ts` (`checkRateLimit:48`, limiters
  :94-100, `getClientIp:194-203`) · auth guards: `apps/web/src/lib/middleware/auth.ts`
- **DEBT register:** `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md` · prior capstones:
  `m-getclientip-migration-resolution-2026-06-05.md`, `h1-rate-limit-availability-resolution-2026-06-05.md`
- **Prior Step-0 menu (for the post-N handoff):** `docs/tech-debt/next-chunk-handoff-2026-06-05-post-m.md`
