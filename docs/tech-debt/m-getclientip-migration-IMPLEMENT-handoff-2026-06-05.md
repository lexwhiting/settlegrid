# (M)+(E) `getClientIp` migration + `processDataExport` guard — IMPLEMENTATION HANDOFF (2026-06-05)

> **Self-contained handoff for a FRESH implementer session. Read this end-to-end before touching
> anything.** SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE
> as a verification facilitator) → suggest `/effort max`.
>
> **Where this chunk stands:** Step-0 (founder pick), the full build plan, and the **HARD,
> independent pre-build audit are already DONE.** The build plan is **PLAN_READY (0 blocking)** —
> two audit rounds, 38 fresh-context agents, all fixes applied (§4 here). Your job is the
> remaining arc: **implement single-writer → verify → mandatory post-build panel (0 blocking) →
> founder-gated local commit → close-out docs.** Do NOT re-open Step-0 or the spine. Do NOT push.

---

## 0. Read order
1. **THIS doc, end-to-end.**
2. **THE BUILD PLAN — your spec, self-contained, PLAN_READY:**
   `docs/tech-debt/m-getclientip-migration-build-plan-2026-06-05.md`. The authoritative recipe:
   the 8-pattern taxonomy (§1.2), every named file with explicit before/after (§4), the behavioral
   deltas (§1.4), the 2 forced test edits (§1.5), the (E) shape + re-derived retry proof
   (§1.6/§4-E), the SCOPE GUARD (§3), both done-check greps (§5.1), the no-regression invariants
   (§6), and the post-build panel lens shape (§7.2). **When this handoff and the plan agree, the
   plan is canonical for line-level detail; this handoff is canonical for sequencing + gates.**
3. `docs/tech-debt/next-chunk-handoff-2026-06-05-post-h1.md` — the parent handoff. §6/§6a (audit
   doctrine + over-auditing guard), §7 (post-build panel), §8 (byte-stable list / settled
   questions — do NOT re-litigate), §11 (standing guardrails), §12 (out-of-scope). Its §3 Step-0 is
   RESOLVED (founder picked (M)+(E), option (i)) — do not re-open.
4. `.audit/m-prebuild/round2-verdict.txt` (PLAN_READY + the 3 improvements/1 nit already applied)
   and `round1-verdict.txt` (the 2 blocking fixes, applied). `.audit/m-prebuild/prebuild-audit.mjs`
   is the audit base if you must re-audit a plan change.
5. `docs/tech-debt/h1-rate-limit-availability-resolution-2026-06-05.md` — the H1 capstone whose
   `processDataDeletion` status machine (E) MIRRORS, and whose capstone-doc shape your close-out
   should follow. `.audit/h1-postbuild/security-panel.mjs` — the **post-build panel base to adapt.**

---

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`, branch `main`. **`origin/main = 93767508`** (pushed, live). Local-only
  stack on top (**push FOUNDER-GATED — do NOT push**) ends at **HEAD = `33d632fa`** (the post-H1
  handoff doc) over `e0c9c504` (H1, panel-PASSED). **Build on this HEAD.** Confirm:
  `git -C /Users/lex/settlegrid status --short && git log -3 --oneline`.
- **LIVE prod (do NOT regress):** x402 proxy + circle-nano kernel settle USDC to
  `0xdcefe0094755ae37395198488f057daa6e430724`; ap2 LIVE as verification facilitator. Prod runs
  `origin/main`; the local stack is NOT deployed.
- **Baselines — re-run BOTH first; all GREEN at this HEAD → ANY red is YOURS:**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4248 pass / 0 failed / 179
    files**) · `npx eslint <changed>` (**0**) · `npx next build` (**0**; do NOT run concurrently
    with tsc — they race on `.next/types`).
  - `cd packages/mcp`: `npx vitest run` (**1896 pass / 1 skip**). This chunk does NOT touch
    `packages/mcp` → **no SDK rebuild.**
- npm (NOT pnpm). Migrations live in `apps/web/drizzle/` — **none needed for this chunk.**
- **Re-derive the migration set in-session** (`/tmp/migration-set.txt` from planning is stale across
  a reboot): `comm -12 <(rg -l 'checkRateLimit|checkTieredRateLimit' apps/web/src --glob '!**/__tests__/**' | sort) <(rg -l 'x-forwarded-for' apps/web/src --glob '!**/__tests__/**' | sort)`
  → **209 incl. `rate-limit.ts`** (the helper, NOT a target) → **208 migrated.**

---

## 2. SCOPE of this implementation chunk (studied + fixed — do not grow or shrink)
**Founder Step-0 decision (2026-06-05): (M) + (E) BUNDLED, settlement-adjacent files LINE-SURGICAL
(option i).** The chunk is a single deliverable; ship it as described, no descoping, no additions.

**IN — exactly what ships (build plan §2):**
1. **(M) the migration sweep — 208 files.** Replace every INLINE `x-forwarded-for` rate-limit
   derivation with `const <var> = getClientIp(<receiver>.headers)`, preserving (a) the existing
   LHS variable name, (b) the handler's Request-param **receiver name** (`request` for ~189 files,
   **`req` for the 6 U5 files** — a literal `request.headers` there is **TS2552**), and (c) the
   identifier template/prefix byte-identical. Add `getClientIp` to each file's existing
   `@/lib/rate-limit` named import. **Migrate EVERY derivation line per file** (~30 files have >1;
   `auth/mfa` has 4). The 19 explicitly-named files (7 U3 two-line wraps, 2 U4, 6 U5, 1 N1, 1 N2,
   2 N3) have explicit before/after in plan §4; the ~189 remainder are blind single-line swaps.
2. **(M) the 2 forced test-sentinel edits** (plan §1.5): `tools/[id]/listed-in-marketplace`
   route.test.ts (`tool-listed:unknown` → `:unknown-ip`) and `x402-facilitator.test.ts`
   (`x402-facilitator-settle:unknown` → `:unknown-ip`). These are the ONLY forced route-test edits
   (the audit confirmed no U2 whole-header route has a multi-entry-XFF identifier-pinning test).
3. **(E) `processDataExport` symmetric guard** (plan §4-E): `compliance.ts:278-279` guard →
   `completed` idempotent no-op (returns the stored `resultUrl`), `failed` retryable, `processing`
   guarded; docstring → real status machine + the **re-derived** retry proof (NO `db.transaction`;
   the proof differs from `processDataDeletion`'s — do NOT copy it). + 3 `settlement-moat.test.ts`
   cases (rewrite the throws-when-already-processed test, add failed-retry + processing-guard).
4. **Close-out docs** (post-panel): a capstone resolution doc; mark publisher-keys DEBT #1 CLOSED;
   memory pointer. This handoff + plan committed alongside.

**OUT — explicitly NOT this chunk (the over-auditing growth vectors — reject if an audit proposes
them; build plan §3, parent §6a):** keying authenticated routes on `auth.id` (a SEPARATE chunk);
adding/removing any rate limit; tuning any limiter number / fail-mode / Upstash timeout; "improving"
any settlement-surface file beyond its ip line; **migrating ANY of the 9 `ipAddress:` audit-log
captures** (would flip `?? undefined` → `'unknown-ip'`, a forbidden semantic change); making the
export route reuse rows; changing any identifier PREFIX. Also out: (A) ACP, (H) hop-route, (C)
`revenueSharePct`, (K) HMAC-pepper (Step-0 non-picks). The H1 standing decisions (fail-open posture,
left-most-XFF correctness, the `'unknown-ip'` sentinel) are **SETTLED** — do not re-open.

**Commit shape:** ONE founder-gated, path-scoped LOCAL commit covering (M)+(E)+docs (matching H1's
bundling of (R)+(D)). (E) MAY be split into its own atomic commit if you prefer, but the post-build
panel must reach 0 blocking for the whole diff either way.

---

## 3. ⛔ THE AUDIT CHAIN — founder hard gate (pre-build SATISFIED; post-build REQUIRED)

The founder's doctrine (real money): **no implementation code ships until a deep, independent
pre-build audit confirms the build plan is comprehensive, high-quality, to-spec, every
technical/factual assumption verified against ACTUAL code, and as error-free as possible — PLAN_READY
(0 blocking) with ALL fixes applied — AND a mandatory independent post-build panel passes (0 blocking)
before any commit.** Both gates carry an explicit **over-auditing / spine-safeguard** clause.

### 3a. Pre-build audit — ALREADY SATISFIED for this chunk (evidence on disk)
The hard pre-build-audit gate **has been met** this session — you do NOT need to re-run it from
scratch unless the plan or HEAD has materially drifted (see 3b). What was done:
- **Mechanism:** a dynamic `Workflow` fan-out (`.audit/m-prebuild/prebuild-audit.mjs`) — a
  `pipeline()` of 4 fresh-context lenses (`factual-assumptions`, `completeness`,
  `correctness-invariant`, `scope-regression`) → adversarial verify (every finding refuted by a
  fresh agent unless a concrete code trace proves it) → guarded synthesis to a PLAN_READY /
  PLAN_NEEDS_FIXES verdict. Each lens RE-DERIVES against actual source — it does not trust the plan.
- **Round 1** (`wf_56f78526-d8e`, 24 agents): PLAN_NEEDS_FIXES — **2 blocking** (the recipe
  hardcoded `request.headers` but 6 files use `req` → TS2552; the done-check allow-list named 2 of
  9 audit captures and the stricter-grep claim was false) + 8 improvements. **All applied.**
- **Round 2** (`wf_c834c0f0-5cb`, 14 agents): **PLAN_READY (0 blocking)** — confirmed both fixes
  landed + the new material sound; 3 improvements + 1 nit, **all applied.** It independently
  verified the census (208), `getClientIp` semantics, FIX-A (6 `req` files), FIX-B (the
  derivation-grep is sound), the U3=7 class, the sentinel census (**no missed forced test edit**),
  and the (E) retry proof. Verdicts: `.audit/m-prebuild/round{1,2}-verdict.txt`.
- **The over-auditing guard was active both rounds** (the `scope-regression` lens + a SCOPE GUARD
  in plan §3): no finding was allowed to grow scope; scope-growing findings are
  `rejected-scope-expansion`. Zero spine churn was introduced by the audit.

### 3b. Your pre-implementation step — fast trust-but-verify (NOT a full re-audit)
Because lines drift and a parallel session may have touched the tree, before implementing:
1. Re-run the baselines (§1) — confirm fully green at YOUR HEAD.
2. Re-derive the 208 set (§1) and spot-check ~5 of the plan's load-bearing claims at current HEAD:
   `getClientIp` still at `rate-limit.ts:194-203`; the 6 U5 files still `req`-named; the 7 U3 files
   still 2-line wraps; the 9 `ipAddress:` captures still `?? undefined`; `compliance.ts:278-279`
   still the export guard. (Greps in plan §1.1–§1.6 / §5.1.)
3. **Only if something material has DRIFTED** (a named file changed shape, the census moved, a claim
   is now false): update the plan for the drift and **re-run the pre-build audit**
   (`Workflow({scriptPath: ".audit/m-prebuild/prebuild-audit.mjs"})`; if a run's subagents die
   "without calling StructuredOutput" from a server rate-limit, resume with
   `Workflow({scriptPath, resumeFromRunId})` — cached agents return) until PLAN_READY again. If
   nothing material drifted, proceed to implement — the gate is already satisfied.
   *(If the founder instead wants a fresh full re-audit regardless of drift, the script + doctrine
   above are ready to run as-is.)*

### 3c. Post-build panel — MANDATORY independent gate, 0 blocking BEFORE any commit
**A green suite is NOT sufficient** (independent audit caught real holes in A1/x402 history). After
implementation + green gates, run a deep independent **security/regression panel** — adapt
`.audit/h1-postbuild/security-panel.mjs` → `.audit/m-postbuild/` (same Workflow fan-out shape:
lenses → adversarial verify → synthesis at **PASS / 0 blocking**). Lenses (plan §7.2):
- **(a) spine-line diff lens (the named requirement):** over the **§7.2 settlement-surface UNION**
  (an explicit enumerated list — proxy, circle-nano/{settle,verify}, ap2/{settle,verify},
  sessions/{route,[id]/route,[id]/{hop,finalize,complete,delegate}}, x402/{supported,verify,settle},
  x402/facilitator/v1/{settle,verify,supported}, cron/{process-payouts,settlement-reconcile,
  expire-sessions}, payouts/{trigger,schedule}, billing/webhook, settlements/[id],
  sdk/{meter,meter-with-metadata}, outcomes/[id]/verify), confirm hunk-by-hunk that **ONLY the
  ip-derivation + `getClientIp` import lines changed** — writer call sites, settle/verify/dispatch
  logic, enforce-exact, identifier templates, response shapes BYTE-IDENTICAL.
- **(b)** value-delta (the §1.4 deltas are the only behavior change; no caller wrongly limited;
  the U4 residual-split proof holds), **(c)** no protection lost (no `checkRateLimit` call
  removed/re-keyed-by-prefix/limiter-swapped), **(d)** completeness (PRIMARY derivation-grep EMPTY;
  SECONDARY allow-list = helper + 9 captures + demo files only; `firstHopIp` fully removed + its
  call site repointed; 2 sentinel pins updated), **(e)** (E) idempotency + retry-safety + retention
  intact, **(f)** scope-regression (`git diff` confined to plan §2; NO byte-stable surface touched;
  NO `ipAddress:` capture changed).
- **Apply the SAME over-auditing/spine-safeguard guard to PANEL findings**: a finding that grows
  scope (vs. proving a real byte-change/regression slipped in) is `rejected-scope-expansion`, not a
  blocker. Verdict **PASS / 0 blocking** before commit. *(This pick is settlement-ADJACENT but
  changes only ip lines → the security/regression panel WITH the spine-line lens IS the
  funds-safety gate; you do not also need the b4 funds-SEAL — but `.audit/b4-postbuild/seal-panel.mjs`
  is there if you want its dark-gate/double-write lenses as extra assurance.)*

---

## 4. Implementation playbook (single-writer; fan-out for the PANEL only)
1. **Order to minimize risk:** do the **19 named files first** (plan §4 — the 7 U3 wraps, 2 U4, 6
   U5 `req`, N1 proxy, N2 `firstHopIp` delete + call-site repoint, 2 N3), running `npx tsc --noEmit`
   after the U5 + N batches so a receiver-name slip surfaces immediately. Then sweep the ~189
   uniform U1/U2 files in directory batches, with periodic tsc checkpoints.
2. **Per file:** add `getClientIp` to the existing `@/lib/rate-limit` import; replace each
   derivation line(s) with `const <var> = getClientIp(<receiver>.headers)`; leave the identifier
   line + every `ipAddress:` capture untouched. **NOT a global sed** (var-name + receiver-name +
   import-shape variance, plan §1.2).
3. **(E):** edit `compliance.ts` `processDataExport` guard + docstring (plan §4-E); add the 3
   `settlement-moat.test.ts` cases. Drive the REAL `processDataExport` in tests (the moat rig), not
   a mocked writer.
4. **The 2 sentinel test edits.**
5. **Verify (plan §7.1):** tsc 0 · vitest **0 failed / ~4250 pass / 179 files** · eslint 0 (changed
   files) · next build 0 · **PRIMARY done-check grep EMPTY**
   (`rg -n "= (request|req)\.headers\.get\('x-forwarded-for'\)" apps/web/src --glob '!**/__tests__/**'`)
   · **SECONDARY allow-list** only (helper + 9 `ipAddress:` captures + demo/kernel literal +
   demo-rate-limit comments) · **U5 spot-check** (`rg "getClientIp\(request\.headers\)"` over the 6
   `req` files = EMPTY) · `packages/mcp` 1896/1.
6. **Post-build panel (§3c) → PASS / 0 blocking.**
7. **Commit (founder-gated, LOCAL, path-scoped — do NOT push):**
   `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com" commit -- <paths>`,
   trailer `Co-Authored-By: Claude <your exact model, e.g. Opus 4.8> <noreply@anthropic.com>`. Quote
   bracketed dirs (e.g. `"apps/web/src/app/api/proxy/[slug]/route.ts"`,
   `"apps/web/src/app/api/sessions/[id]/hop/route.ts"`). Shared-worktree hazard → atomic
   path-scoped commits only.
8. **Close-out:** capstone resolution doc (mirror the H1 capstone); publisher-keys DEBT #1 → CLOSED
   (`docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`) + the post-H1 handoff capstone §5.1/§5.2
   → resolved; memory pointer `m-getclientip-chunk.md`. (Push + any prod action remain FOUNDER-GATED.)

---

## 5. Guardrails (real money — non-negotiable)
- **Single-writer core; READ-ONLY parallel verification.** Fan-out is for the post-build PANEL (and
  any re-audit) ONLY — never to mutate files in parallel.
- **Ground every conclusion in ACTUAL tool output.** The green suite has historically masked holes;
  the panel + the two done-check greps are the real gate.
- **Line-surgical on settlement-surface files** (plan §3 / §7.2 union): ONLY ip-derivation +
  `getClientIp` import lines change; everything else byte-identical.
- **Byte-stable / settled — do NOT touch or re-litigate** (parent §8): the exactly-once credit
  machinery, take model (`take_bps=0`), B4 `account_id`-is-developer-id, `developers.balanceCents`
  authority, the H1 standing decisions, the 9 `ipAddress:` audit captures.
- Do NOT push; do NOT set/change prod env; do NOT apply migrations (none needed); demo sandbox must
  never reach a real settle.
- **Flag context degradation** the moment it risks implementation quality (founder standing order) —
  the 208-file sweep is the high-volume phase; if quality is at risk, checkpoint progress and
  recommend a continuation session.

---

## 6. File-path index (everything you need)
- **Build plan (spec, PLAN_READY):** `docs/tech-debt/m-getclientip-migration-build-plan-2026-06-05.md`
- **This handoff:** `docs/tech-debt/m-getclientip-migration-IMPLEMENT-handoff-2026-06-05.md`
- **Parent handoff (doctrine/guardrails):** `docs/tech-debt/next-chunk-handoff-2026-06-05-post-h1.md`
- **Pre-build audit (DONE):** `.audit/m-prebuild/prebuild-audit.mjs` + `round1-verdict.txt` +
  `round2-verdict.txt`
- **Post-build panel base (adapt):** `.audit/h1-postbuild/security-panel.mjs`
  (funds-SEAL base, optional: `.audit/b4-postbuild/seal-panel.mjs`)
- **(E) pattern to mirror + capstone-doc shape:**
  `docs/tech-debt/h1-rate-limit-availability-resolution-2026-06-05.md`
- **Helper (source of truth):** `apps/web/src/lib/rate-limit.ts` (`getClientIp:194-203`)
- **(E) target:** `apps/web/src/lib/settlement/compliance.ts` (`processDataExport`, guard `:278-279`)
- **Registers to update at close:** `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md` (DEBT #1
  → CLOSED), the post-H1 handoff capstone follow-ons §5.1/§5.2.
- **Memory:** `/Users/lex/.claude-account2/projects/-Users-lex/memory/` — see `m-getclientip-chunk.md`.
