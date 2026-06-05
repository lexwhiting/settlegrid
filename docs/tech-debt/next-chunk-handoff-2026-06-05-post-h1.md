# SettleGrid — NEXT CHUNK handoff (post-H1, Step-0-gated) (2026-06-05)

> **Self-contained handoff for a fresh agent. Read this end-to-end before doing anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a
> verification facilitator) → suggest `/effort max`. The HARD gate is a **deep, independent
> PRE-BUILD AUDIT of your build plan** (§6) — **no implementation code until it returns
> PLAN_READY (0 blocking) with ALL fixes applied** — and a **mandatory post-build panel** (§7)
> before any commit.
> **⚠️ Read §3 (Step-0) first-thing.** The settlement-spine arc (money-mechanics → B4) is DONE
> and SEALED; H1 (the first off-spine hardening chunk) is DONE and panel-PASSED, and the test
> baseline is **fully green for the first time**. The strongest remaining settlement candidates
> are still **gated on signals only the founder has** (is BD in motion? is multi-hop attribution
> wanted?). The recommended lead is the **documented H1 follow-on** — finish DEBT #1 with the
> mechanical `getClientIp` call-site migration. **The founder picks.**

## 0. Read order
1. **This doc, end-to-end.**
2. `docs/tech-debt/h1-rate-limit-availability-resolution-2026-06-05.md` — the chunk just
   completed (capstone): the fail-open contract, the 3 new route gates, the deletion status
   machine, **the 3 handoff corrections** (§2 there — ephemeralCache already ON; rejection-path
   only; left-most XFF NOT spoofable on Vercel), and the follow-on list (§5 there) that seeds
   this fork. Its §6 standing decisions are settled — do not re-litigate.
3. `docs/tech-debt/h1-rate-limit-availability-build-plan-2026-06-05.md` — the **build-plan +
   SCOPE GUARD shape to reuse** (mirror its §3 SCOPE GUARD and §8/§9 statements; it survived a
   PLAN_READY round-1 audit).
4. `docs/tech-debt/next-chunk-handoff-2026-06-04-post-b4.md` — the prior fork (B4→H1); its §3
   grounding for options (A)/(H)/(C) below remains the canonical detail (those files were NOT
   touched by H1 — claims carry, line numbers may drift).
5. IF Step-0 picks (A): `docs/tech-debt/p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md` —
   the full ACP-dark scope (§4), still the canonical spec.
6. `.audit/` (LOCAL, untracked, gitignored — on disk): `h1-prebuild/prebuild-audit.mjs` (the
   **freshest PLAN_READY pre-build workflow base**) + `h1-postbuild/security-panel.mjs` (the
   **freshest off-spine post-build panel base**) + `b4-postbuild/seal-panel.mjs` (the freshest
   **funds-SEAL** base, needed only if the pick touches settlement). Adapt these (§6/§7).

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`. Branch `main`. **`origin/main` = `93767508`** (money-mechanics,
  pushed + live). **Local-only stack on top (push FOUNDER-GATED, do NOT push) — 8 commits:**
  `9a9f866d` → `df9a2477` (ACP claims CERTIFIED) → `2e4da629` → `119d1f8a` (gitignore /.audit/)
  → `f378558c` → `be43b501` (B4 SEALED) → `5fc24ee6` (post-B4 handoff) → **`e0c9c504` (H1,
  panel-PASSED) = HEAD.** Confirm: `git -C /Users/lex/settlegrid status --short && git log -3
  --oneline`. **Build on `e0c9c504`.**
- **LIVE prod (do NOT regress):** x402 proxy + circle-nano kernel `/settle` settle USDC to
  `0xdcefe0094755ae37395198488f057daa6e430724`; ap2 LIVE as verification facilitator. Prod runs
  `origin/main` — the local stack (B4, H1) is NOT deployed.
- **Base green expected (run BOTH suites first) — NOTE THE NEW, FULLY-GREEN BASELINE:**
  - `cd apps/web` → `npx tsc --noEmit` (0) · `npx vitest run` (**4248 pass / 0 failed / 179
    files** — the old "1 known pre-existing fail" is GONE; any red is YOUR regression) ·
    `npx eslint <changed>` (0) · `npx next build` (0; do NOT run concurrently with tsc — they
    race on `.next/types`).
  - `cd packages/mcp` → `npx vitest run` (**1896 pass / 1 skip**). Rebuild the SDK only if the
    picked chunk edits it (only (A) does; (M)/(E)/(H)/(C) do NOT).
- npm (NOT pnpm). viem is **apps/web-only**. `route.ts` files export only HTTP verbs + Next
  config. Migrations live in `apps/web/drizzle/` (last `0013_developer_api_keys.sql`). **Founder
  applies migrations to prod — NEVER run one against prod.** (No candidate below needs one.)

## 2. The chunk — goal
This chunk is **Step-0-gated**: pick from the grounded fork in §3, then execute with the **full
3-part audit chain** (pre-build audit → implement surgically single-writer → post-build panel).
The recommended default is the **H1 follow-on hygiene chunk (M)+(E)** — actionable now, no
external signal — but the founder decides.

## 3. ⚠️ Step-0 — the next-chunk decision (REQUIRED before you scope anything)
**The landscape was re-grounded against actual code at `e0c9c504` (2026-06-05). Findings below;
re-verify any line you depend on — they drift.**

**RECOMMENDED LEAD — (M) `getClientIp` call-site migration (+ (E) bundled) — "finish DEBT #1".**
The documented H1 follow-on (capstone §5.1), now precisely censused:
- **209 non-test files** call `checkRateLimit`/`checkTieredRateLimit` AND derive the IP inline
  from `x-forwarded-for` (213 limiter-caller files total; ~238 inline sentinel lines). Two
  styles persist (whole-header `?? 'unknown'` vs `.split(',')[0]?.trim() ?? 'unknown'`).
  `getClientIp` (`apps/web/src/lib/rate-limit.ts:194`, shipped by H1) is the single source of
  truth — the migration replaces every inline derivation with it.
- **HONEST VALUE FRAMING (H1 correction #3 stands):** on Vercel this is **consistency/portability
  hygiene, NOT a vulnerability fix** — Vercel overwrites XFF (official docs, cited in the
  `getClientIp` docstring), so both existing styles already resolve to the same correct value in
  prod. The merit: kills the two-style drift forever, completes DEBT #1, adds the `x-real-ip`
  fallback + a consistent sentinel everywhere, makes any future off-Vercel move safe.
- **Behavioral deltas to enumerate in the plan (small but REAL — the audit must verify):**
  (i) sentinel changes `'unknown'` → `'unknown-ip'` for header-less requests (one-time bucket
  re-key for anonymous traffic — harmless, sliding windows just restart); (ii) `x-real-ip`-only
  requests now resolve to an IP instead of the sentinel (on Vercel x-real-ip ≡ XFF, so no prod
  delta; matters only in dev/tests); (iii) whole-header style on a hypothetical multi-entry XFF
  would have produced a different bucket key than split-style — unifying removes that
  inconsistency by construction.
- **Forced-test-edit surface (censused, small):** **0** tests pin `checkRateLimit` identifier
  args via `toHaveBeenCalledWith` repo-wide EXCEPT H1's 3 new route tests (they mock
  `getClientIp` — migration-immune). Exactly **2 test files** assert `':unknown'` identifier
  strings and need the sentinel edit IF their routes migrate:
  `src/app/api/tools/[id]/listed-in-marketplace/__tests__/route.test.ts` and
  `src/app/api/__tests__/x402-facilitator.test.ts`. Re-census in the plan
  (`rg -l ":unknown'" apps/web/src --glob '**/__tests__/**'`).
- **⚠️ THE SCOPE HAZARD (this chunk's trap — the INVERSE of H1's):** the migration set includes
  **7 settlement-adjacent route FILES**: `api/proxy/[slug]/route.ts` (2 XFF lines; :433-434),
  `api/circle-nano/settle/route.ts`, `api/ap2/settle/route.ts`, `api/sessions/[id]/hop/route.ts`,
  `api/x402/{supported,verify,settle}/route.ts`. The spine contract (§8) is at the **LINE** level
  here, not the file level: ONLY the ip-derivation line (+ the import line) may change in those
  files; writer call sites (`accountId: toolRow.developerId`), settle/verify logic, dispatch,
  enforce-exact — byte-identical. **Plan decision:** (i) include them under a line-surgical
  recipe with a dedicated post-build spine-line diff lens (recommended — full consistency), or
  (ii) exclude the 7 and document the residue (safer, breaks "zero residual styles"). Recommend
  (i): the edit is mechanical and the panel verifies it.
- **The recipe is uniform and offline-testable:** per file — add `getClientIp` to the existing
  `@/lib/rate-limit` import; replace the derivation line with
  `const ip = getClientIp(request.headers)` (identifier template lines untouched). EXCLUDED:
  `src/app/auth/callback/route.ts` (the ONE non-limiter XFF file — audit-log `ipAddress`
  capture, different purpose, stays as-is, documented); `demo-rate-limit`/H1's 3 routes (already
  on the helper). Done-check: `rg "x-forwarded-for" apps/web/src --glob '!**/__tests__/**'`
  returns ONLY `rate-limit.ts` (the helper itself) + `auth/callback/route.ts` (+ comments).
  No migration, no SDK change, no limiter-number changes, no new limits.
- **(E) bundled — `processDataExport` symmetric guard (capstone §5.2).** Same
  `status !== 'pending'` wedge pattern at `lib/settlement/compliance.ts:278-280` as the OLD
  deletion guard. **Verified honest framing:** NOT prod-reachable as a wedge — the only caller
  (`api/dashboard/developer/data-export/route.ts:77-80`) creates a FRESH export row per request
  and processes it immediately; a `failed` row is simply abandoned. So (E) is pure
  hygiene/symmetry: mirror the deletion status machine (`completed` → no-op return,
  `failed` → retryable, `processing` → guard) on `processDataExport`, with the same
  atomicity-proof requirement (verify: does processDataExport set `completed` INSIDE its txn?
  — TRACE IT before claiming the retry-safety proof carries; if its write shape differs, the
  proof must be re-derived, not copied). Tiny; offline; settlement-moat tests likely gain 2-3
  cases. Could be dropped without weakening (M).

**ALTERNATIVES (grounded; bring the founder the trade-offs):**
- **(A) ACP-dark kernel wiring — settlement-arc continuation, BD-GATED (unchanged).** Pursue
  ONLY if the founder says OpenAI/Stripe merchant onboarding/BD is in motion. H1 touched NONE of
  its files — the full scope in `p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md §4` remains
  canonical (re-verify lines at HEAD anyway). **Hard pre-condition unchanged:** pure web
  research FIRST re: the operative ACP payment flow (the SDK's `validateAcpPayment` models the
  Stripe SPT checkout-session retrieve whose in-chat flagship OpenAI sunset 2026-03-24 — confirm
  service providers still verify via that retrieve). No offline gold test → ships **dark**
  (`ACP_STRIPE_KEY` UNSET in prod). Touches the SDK (rebuild + 1896-suite). Post-build gate =
  **funds-SEAL** (adapt `.audit/b4-postbuild/seal-panel.mjs`).
- **(H) hop-route schema extension — DEMAND-GATED + reconciler-starvation trap (unchanged).**
  Only if multi-hop ledger attribution is now wanted. Zero consumers verified at `be43b501`
  (H1 touched only the hop route's UNRELATED rate-limit area — re-verify). MANDATORY guard:
  constrain the hop `rail` enum to EXCLUDE `{x402, circle-nano}` (else hop rows are re-SELECTed
  by the reconciler forever — starvation). Funds-SEAL post-build.
- **(C) `revenueSharePct` legacy cleanup — unchanged, lower priority.** Inert column
  (`metering.ts:298` "Legacy — ignored"); MED churn (~20 files + migration + guard-test rewrite
  in `metering.test.ts`); LOW-but-real hazard: the `sdk/meter` free-tier overage gate branches
  on `revenueSharePct === 100` (`sdk/meter/route.ts:~75`) — must re-derive from `tier` FIRST.
  Deliberate hygiene only.
- **(K) publisher-keys register small-bundle — optional.** Remaining LOW items in
  `publisher-api-keys-audit-2026-05-28.md` (post-H1 UPDATE section): #2 TOCTOU key-cap
  (self-affecting), #4 prefix fast-fail (NIT), #8 Settings-UI/email-template test gap. The only
  MEATY one is **#3: HMAC-pepper the API-key hash** (`lib/crypto.ts hashApiKey` — unsalted
  shared SHA-256 across `sg_live_`/`sg_pub_`): real defense-in-depth IF the DB is ever
  disclosed, but touches the auth path for ALL keys and needs a pepper env + dual-read
  migration strategy — a careful dedicated chunk, NOT a bundle item. Pick (K) only as a
  deliberate cleanup pass.

**The founder picks. Do NOT scope or plan before Step-0 is resolved.** Bring the trade-offs.
*(Prior-session lean, for context not pre-emption: **(M)+(E)** — it finishes what H1 started,
needs no signal, and retires DEBT #1 entirely; **(A)** only if BD moved; (H)/(C)/(K) defer.)*

## 4. Scope sketches (verify everything — sketches, not plans)

**IF (M)+(E) — recommended shape:**
1. Mechanical sweep (the §3 recipe) across the ~209 files; line-surgical handling of the 7
   settlement-adjacent files; `auth/callback` excluded + documented.
2. The 2 `':unknown'`-pinning test files updated to `'unknown-ip'`.
3. (E): `processDataExport` status-machine mirror + docstring + settlement-moat test additions
   (trace its txn shape FIRST — see §3).
4. NEW guard test: a repo-hygiene test asserting no residual inline XFF derivation outside the
   allowlist (greppable contract — decide test vs. documented done-check in the plan).
5. Verification: full gates (§9) + the done-check grep. Expect ~210-215 files in the diff —
   LARGE but uniform; the audit + panel carry the regression burden, per-file risk is 1 line.

**IF (A)/(H)/(C):** see the pointers in §3 — the post-B4 handoff §4 sketches remain canonical
for these (H1 did not disturb them); re-verify all lines at HEAD.

## 5. Key files (verify line numbers — they DRIFT; compliance.ts numbers CHANGED in H1)
- **(M):** `apps/web/src/lib/rate-limit.ts` (`getClientIp:194`, `checkRateLimit:48`,
  `RateLimitFailMode:31`, tiered guard `:163`); the 7 spine-adjacent routes (§3); the 2 pinning
  test files (§3); `src/app/auth/callback/route.ts` (the exclusion).
- **(E):** `apps/web/src/lib/settlement/compliance.ts` — `processDataExport` guard `:278-280`;
  the H1 deletion pattern to mirror: docstring `:333-341`, completed-no-op `:360-364`,
  processing-guard `:366-369`, proceed-comment `:371-372`; tests
  `src/lib/__tests__/settlement-moat.test.ts` (the H1 `setupDeletionRunMocks` rig pattern).
- **(A):** see `p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md §5` (verified undisturbed).
- **(H):** `api/sessions/[id]/hop/route.ts` (hopSchema :13-20 region — H1 added a comment above
  the limit area; re-check), `lib/settlement/sessions.ts` (`recordHop`),
  `lib/settlement/reconcile.ts` (the SELECT + `parseSettlementOperationId` — the trap).
- **Spine (RECORD, do NOT rewrite — any chunk):** `lib/settlement/ledger.ts`
  (`recordSettlementEntry`, `settlementEntryId`, `markSettlement*`), `reconcile.ts`
  (`creditSettlement` + the B4 zero-row throw), `payouts/process.ts`, `lib/pricing.ts`, the
  orchestrators, the 4 writer call sites.

## 6. ⛔ HARD GATE — deep, independent PRE-BUILD AUDIT of the build plan (MANDATORY, before ANY code)
After Step-0 + writing the build plan (and BEFORE any implementation code), run a **deep,
independent pre-build audit via a dynamic `Workflow` / agent fan-out**. It MUST confirm the plan
is **comprehensive, high-quality, to-spec, every technical & factual assumption verified against
the ACTUAL code, and as error-free as possible** — and it MUST reach **PLAN_READY (0 blocking)
with ALL fixes applied before implementation begins.** Founder requirement; not optional.

**Mechanism (proven 5 chunks running — adapt `.audit/h1-prebuild/prebuild-audit.mjs`, the
freshest base):** a `Workflow` script, `pipeline()` of fresh-context lenses → adversarial verify
→ guarded synthesis:
- **Lenses (parallel, each RE-DERIVES against ACTUAL source, NOT trusting the plan):**
  `factual-assumptions` (every file:line + §3 ground truth re-verified live — for (M): the
  209/213 census, the 2 pinning tests, the 7 spine-adjacent files, the sentinel/x-real-ip
  deltas, the auth/callback exclusion rationale; for (E): the export txn shape + the
  fresh-row-per-request caller claim), `completeness` (EVERY forced test edit enumerated; a
  literal follow yields GREEN suites in BOTH packages at the NEW baseline 4248/0 + 1896/1; the
  done-check grep is complete), `correctness-invariant` (off-funds form: no caller wrongly
  limited, no identifier collision/cross-bucket merge introduced, the spine-LINE byte-stable
  contract on the 7 files, (E) retry-safety proof re-derived not copied), and
  **`scope-regression`** (§6a). Use **full-reasoning agents** (the workflow default — NOT the
  search-only `Explore` type).
- **Adversarial verify:** every finding independently refuted by ≥1 fresh agent (default
  "refuted" unless a concrete code trace proves it real).
- **Synthesis → verdict** `PLAN_READY` / `PLAN_NEEDS_FIXES` (+ blocking list). **Apply ALL
  blocking fixes, re-run a FRESH audit (agents re-read the revised plan), repeat until
  PLAN_READY.**
- *(Ops notes, proven: a server rate-limit can kill a workflow's subagents mid-run — they finish
  "without calling StructuredOutput". **Resume with `Workflow({scriptPath, resumeFromRunId})`**
  — completed agents return from cache. Worked on the B4 SEAL; H1's two runs needed no resume.)*

### 6a. ⚠️ Over-auditing regression guard (safeguard the spine)
Pre-build audits balloon scope. The **`scope-regression` lens is the spine guard**: it must
confirm the plan stays **mechanical/surgical** and FLAG any finding that adds scope, new money
movement, behavior changes, or churn beyond the founder's Step-0 decision. Encode an explicit
**SCOPE GUARD** section in the build plan (mirror
`h1-rate-limit-availability-build-plan-2026-06-05.md §3`). **Treat any scope-growing audit
finding as REJECT-with-rationale (`severityFinal: 'rejected-scope-expansion'`), not auto-apply.**
**Zero findings is a valid outcome; do not hallucinate problems.**
*(For (M) specifically, the predicted growth vectors to HOLD THE LINE against: "also key
authenticated routes on auth.id" (register sketch (c) — a SEPARATE chunk), "also add limits to
more routes", "also tune limiter numbers / fail-modes", "also 'improve' the 7 settlement files
while you're in there", "also migrate auth/callback's audit-log capture". For (E): "also make
the export route reuse failed rows". ALL rejected unless the founder scoped them in. The H1
standing decisions — fail-open posture, left-most-XFF correctness, sdkLimiter/authLimiter
choices — are SETTLED; an audit finding re-litigating them needs a concrete NEW trace to be
anything but rejected.)*

## 7. Post-build panel (MANDATORY before commit — lens-shape depends on the picked chunk)
After implementation + green gates, run a **deep, independent post-build panel**. **A green
suite is NOT sufficient** — independent audit caught real holes in A1/x402 history. Calibrate:
- **If (M)/(E)/(C)/(K) (off the funds spine): a security/regression panel** (adapt
  `.audit/h1-postbuild/security-panel.mjs`, the freshest base). For (M) it MUST include a
  dedicated **spine-line diff lens**: in the 7 settlement-adjacent files, ONLY the
  ip-derivation + import lines changed — writer call sites, settle/verify/dispatch logic
  byte-identical (hunk-by-hunk). Plus: no caller wrongly limited (identifier value deltas
  enumerated + bounded), no bucket-key collision introduced, the 2 test-file edits pin the new
  sentinel, the done-check grep holds, (E) idempotency + retention intact. Verdict **PASS /
  0 blocking**.
- **If (A)/(H) (settlement surface): a funds-safety SEAL panel** (adapt
  `.audit/b4-postbuild/seal-panel.mjs`) — wrongly-enabled real-money settle, ledger
  double-/under-write, exactly-once/take-model break, byte-stable drift, dark-gate leak (ACP
  off in prod), reconciler mis-/zero-credit, demo-sandbox reach. Verdict **SEAL (0 blocking)**.
Either way: **0 blocking** before any commit, with the §6a scope guard applied to panel
findings too.

## 8. BYTE-STABLE (do NOT rewrite) + settled questions (do NOT re-litigate)
- The sealed exactly-once credit machinery: `recordSettlementEntry` internals +
  `settlementEntryId` + `onConflictDoNothing` (FIRST-WRITE-WINS), `markSettlement*`,
  `findSettlementRow`, `creditSettlement` + its B4 zero-row throw, the orchestrators, the payout
  pipeline + progressive take (`lib/pricing.ts`), the on-chain engines/verifiers, dedup on
  `(from,nonce)`. **In the 7 spine-adjacent files (if (M)): everything except the ip-derivation
  + import lines.**
- **The take model is SETTLED** (`take_bps=0` on rows CORRECT; take at payout; dev credited
  GROSS). **Settlement-row `account_id` IS the developer id (B4, PERMANENT)** — never backfill
  (guard-tested). **`developers.balanceCents` is the ONLY authoritative balance.**
- **H1 standing decisions (capstone §6): fail-open + alert on ALL routes; left-most-XFF +
  x-real-ip fallback is CORRECT on Vercel (do NOT "fix" to rightmost); limiter choices for the
  3 H1 routes; no limiter-number tuning; no Upstash timeout tuning.** The `failMode:'closed'`
  hook exists, unused — adopting it anywhere is founder-gated.
- All SEAL/CERTIFIED/PASSED commits (x402, circle-nano, money-mechanics, ACP claims `df9a2477`,
  B4 `be43b501`, H1 `e0c9c504`). A new chunk is ADDITIVE/surgical, not a rewrite.

## 9. Verification gates
`cd /Users/lex/settlegrid/apps/web`: `npx tsc --noEmit` (0) · `npx vitest run` (**4248 pass /
0 failed baseline + your additions; ANY failure is yours now**) · `npx eslint <changed files>`
(0) · `npx next build` (0; NOT concurrent with tsc). **PLUS** `cd packages/mcp && npx vitest
run` (1896/1 skip; rebuild SDK only if edited — only (A)). For (M) add the done-check grep
(§3). **DB-affecting behavior must be proven with the REAL functions** (mocked writer
insufficient — A1's lesson). Migrations: none needed for (M)/(E)/(H); (A) none; (C) one —
generate + lint locally only; **applying to prod is FOUNDER-GATED.**

## 10. Sequencing (the founder-required order)
Pre-flight (§1) → **Step-0 decision (§3, founder picks)** → (if (A): the web-research
pre-condition FIRST) → trace + finalize scope → write the BUILD PLAN (with the §6a SCOPE GUARD
section) → **PRE-BUILD AUDIT until PLAN_READY, all fixes applied (§6)** → implement surgically
(single-writer) → post-build verify (§9) → **post-build panel (§7, calibrated per chunk)** →
founder-gated local commit (path-scoped) → capstone/register docs + memory pointer → (push +
any migration apply remain FOUNDER-GATED).

## 11. Standing rules / guardrails (real money)
- **Single-writer core + READ-ONLY parallel verification.** Fan-out is for AUDIT only.
- **Ground every conclusion in ACTUAL tool output** — re-verify every file:line in this doc;
  the green suite has historically masked holes — the audits are the real gate.
- Commit **LOCAL-ONLY**, **path-scoped** (`git commit -- <paths>`; quote bracketed dirs).
  `git user.name` is unset → commit with `git -c user.name="Luther Whiting-Collins"
  -c user.email="lexwhiting@gmail.com" commit …`, trailer
  `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`.
- **Shared-worktree hazard:** parallel sessions share the tree + index — atomic path-scoped
  commits only.
- Do NOT push; do NOT set/change prod env; do NOT apply migrations to prod; demo sandbox must
  never reach a real settle; (if (A)) keep `ACP_STRIPE_KEY` UNSET in prod (dark).
- **Flag context degradation** the moment it risks implementation quality (founder standing
  order).

## 12. Out of scope / deferred (do NOT chase; verified moot/blocked)
- **`postLedgerEntryAsync` / fire-and-forget→`after()`: MOOT** (zero prod callers; every LIVE
  settlement write already durable). **UCP: RESEARCH-ONLY** (verify is a no-op stub; no offline
  primitive). **CRON_SECRET rotation: OPS** (fail-closed everywhere). **Tier-2/3 rails:** blocked
  on partner sandboxes. **B1.4 reconciler debt:** gated on x402 facilitator-mode ON in prod
  (off today).
- **From H1 (documented, not chunks):** crashed-`'processing'` deletion = manual runbook
  (capstone §5.3); unsubscribe TTL/HMAC redesign; per-handler upstream budgets on serve;
  fail-closed adoption; Upstash timeout/analytics tuning. **DEBT #5's "post-rewrite email"
  sub-claim: verified STALE** (capstone §5.4) — do not chase.
- The P5 master doc + the publisher-keys register (post-H1 UPDATE section) are the registers to
  UPDATE at close, not rewrite.
