# SettleGrid — NEXT CHUNK handoff: P5 Tier-1 ACP kernel-dispatch (Step-0 may pivot) (2026-06-04)

> **Self-contained handoff for a fresh agent. Read this end-to-end before doing anything.**
> This touches **real money** (x402 + circle-nano settle real USDC on Base; ap2 + the money-mechanics
> chunk are LIVE) → suggest `/effort max`. The HARD gate is the **deep, independent PRE-BUILD AUDIT of
> your build plan** (§6) — **no implementation code until it returns PLAN_READY with ALL fixes applied.**
> **⚠️ Read §3 (Step-0) first-thing: the nominal target (ACP) is effectively gated/Tier-2 — Step-0
> decides whether to wire ACP-dark now or pivot. Do NOT assume a clean drop-in.**

## 0. Read order
1. **This doc, end-to-end.**
2. `docs/phase-reports/P5-kernel-dispatch-expansion-deferred.md` — the master P5 plan + the **"AP2 — LANDED"**
   and **"CIRCLE-NANO — LANDED"** sections (the EXACT file-by-file pattern to mirror) + the readiness triage
   (note ACP is flagged Tier-2/gated there, lines 113 + 135).
3. `docs/tech-debt/ap2-kernel-dispatch-2026-05-28.md` + `docs/tech-debt/circle-nano-kernel-dispatch-2026-05-29.md`
   — the two landed Tier-1 audit-chain PRs (the template + their DEBT registers).
4. `docs/tech-debt/settlement-money-mechanics-seal-2026-06-04.md` (the chunk just before this) +
   `docs/tech-debt/settlement-money-mechanics-build-plan-2026-06-03.md` (the **build-plan + pre-build-audit
   shape to reuse**) + `docs/tech-debt/a1-facilitator-ledger-writes-2026-05-30.md` (the ledger spine + the
   **take-model truth** + the A1/A2 traps). **The single most important grounding for the settlement spine.**
5. `.audit/money-mechanics-{prebuild,postbuild}/` (untracked, local) — the **runnable pre-build/post-build
   audit workflow scripts** that produced PLAN_READY + SEAL last chunk. Adapt them (§6/§7).

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`. Branch `main`, **HEAD = `origin/main` = `93767508`** (synced; the
  money-mechanics chunk is pushed + live). Confirm: `git -C /Users/lex/settlegrid status --short && git log -1 --oneline`.
- **LIVE prod (do NOT regress):** x402 proxy + circle-nano kernel `/settle` settle USDC to the revenue wallet
  `0xdcefe0094755ae37395198488f057daa6e430724`; ap2 is LIVE as a verification facilitator (no funds through SettleGrid);
  the money-mechanics chunk (enforce-exact circle-nano + durable ap2 ledger write via `after()`) is LIVE.
- **Base green expected (run BOTH suites first):**
  - `cd apps/web` → `npx tsc --noEmit` (0) · `npx vitest run` (**~4220 pass / 1 KNOWN pre-existing fail**
    `processDataDeletion` in `settlement-moat.test.ts`) · `npx eslint <changed>` (0) · `npx next build` (0).
  - `cd packages/mcp` → `npx vitest run` (the **SDK** suite — ~1893 pass). **ACP wiring TOUCHES THE SDK**, so
    this suite matters this chunk (the money-mechanics chunk did NOT touch the SDK; AP2 + circle-nano did).
- npm (NOT pnpm). viem is **apps/web-only**. Route files (`route.ts`) may export only HTTP verbs + Next config.
  **⚠️ ACP wiring requires `packages/mcp` edits** (`extractPaymentContext`, a verify-core, the kernel) — **rebuild
  the SDK after editing it** (`packages/mcp` build) or the app won't pick up the change.

## 2. The chunk — goal
Continue **P5 kernel-dispatch expansion**: graduate the next Tier-1 adapter from *detected* to *settled
end-to-end* through `handleFacilitatorProtocol`, at parity with AP2/circle-nano, with the **full 3-part audit
chain** (pre-build audit → implement → post-build SEAL). The **nominal** target is **ACP** — but it is gated;
**§3 Step-0 resolves the actual scope.**

## 3. ⚠️ Step-0 — the ACP-readiness decision (REQUIRED before you scope anything)
**GROUND TRUTH (verified this handoff):** **ACP's verify is NOT offline.** `validateAcpPayment`
(`packages/mcp/src/adapters/acp.ts:323`) makes a **LIVE Stripe API call** — `retrieveCheckoutSession` →
`fetch('https://api.stripe.com/v1/checkout/sessions/...')` — needing **`ACP_STRIPE_KEY`** + a **ChatGPT-issued
Stripe SPT checkout session**. Unlike AP2 (offline HMAC VDC) and circle-nano (offline EIP-3009 via viem), ACP
**cannot be exercised end-to-end without OpenAI ChatGPT-merchant onboarding + a Stripe key**. The P5 doc records
ACP as effectively **Tier-2/gated** and circle-nano was deliberately *"chosen over ACP"* for exactly this reason.

**So research + bring the founder a grounded recommendation (mirror the circle-nano Step-0):**
- **(A) Wire ACP-DARK now** (code-only, gated): create `/api/acp/{verify,settle}`, add `'acp'` to
  `PHASE_1_KERNEL_PROTOCOLS` + the facilitator gate, capture the ACP token into `payment.proof` (AP2-style),
  add the ledger write (with the money-mechanics lessons), tests with **MOCKED Stripe**. **Cost/caveat:** there
  is **no offline "gold test"** possible (circle-nano had one; ACP's verify is a live Stripe call), so the
  real-money path is unprovable until onboarding; it ships **dark** (`ACP_STRIPE_KEY` unset in prod). Value =
  AP2-parity + groundwork.
- **(B) Pivot to a higher-value chunk** (all grounded in the deferred registers — bring the trade-offs):
  - **Legacy direct-proxy circle-nano tightening** (circle-nano-kernel-dispatch DEBT #2): route the legacy
    `/api/proxy/[slug]` circle-nano path through `verifyCircleNanoAuthorization` — it's **structural-only today**
    (no crypto/payee), gated on `CIRCLE_NANO_API_KEY`. Real funds-correctness, offline-testable.
  - **Repo-wide fire-and-forget durability** (money-mechanics deferred): `after()` for
    `settlement/sessions.ts:469` (`recordHop`) + `postLedgerEntryAsync` — the pattern this chunk established
    for ap2, generalized.
  - **UCP** — but its verify is a **no-op stub** (P5 doc); needs verify SEMANTICS research before it's worth wiring.
  - **Accounts provisioning + `accountId` backfill** (A1 debt) — larger; resolves the settlement-row attribution stand-in.
- **The founder picks. Do NOT scope or plan before Step-0 is resolved.** (Founder is comfortable with this
  Step-0-decision pattern — every prior chunk used it.)

## 4. IF ACP is chosen — scope (mirror the AP2 audit-chain PR exactly)
**What EXISTS today (verified):**
- `packages/mcp/src/adapters/acp.ts` — `ACPAdapter`, `validateAcpPayment` (live Stripe lookup),
  `generateAcp402Response`, `isAcpRequest`, `buildChallenge`, `verify()`. NOTE `extractPaymentContext`
  currently puts the ACP token in `identity.value`, **NOT `payment.proof`**.
- `apps/web/src/lib/acp-proxy.ts` — app wrapper (`validateAcpPayment` injecting env, `generateAcp402Response`,
  `isAcpRequest`). **NO `validateAcpCredentialString`** core yet (ap2/circle-nano have one keyed on the forwarded proof).
- `apps/web/src/lib/env.ts` — **`isAcpEnabled()` (ACP_STRIPE_KEY set) + `getAcpStripeKey()` already exist** (≈:225-230).
- `apps/web/src/lib/settlement/adapters/acp.ts` — a settlement adapter (read it).
**What's MISSING (the chunk's work):**
1. `apps/web/src/app/api/acp/{verify,settle}/route.ts` — facilitator endpoints (mirror `api/ap2/{verify,settle}`:
   server-authoritative tool+cost lookup, `isAcpEnabled` gate, RAW `{valid}` / `SettlementResult` bodies — NOT the
   `successResponse`-enveloped public x402 contract).
2. `'acp'` in `PHASE_1_KERNEL_PROTOCOLS` (`packages/mcp/src/kernel.ts:222`) + the facilitator gate
   (`kernel.ts:406-409`, currently `x402 || mpp || ap2 || circle-nano`).
3. `extractPaymentContext` must capture the ACP token into **`payment.proof`** (AP2-style — P5 doc line 94), so it
   survives the kernel→facilitator hop (the kernel forwards only `paymentContext`, not raw headers). Then a verify-core
   (split `validateAcpPayment` into a reusable `validateAcpCredentialString(token, opts)`, mirroring AP2's split).
4. **Ledger write on settle** — `recordSettlementEntry`, **with the money-mechanics lessons** (§8): `takeBps: 0`
   (CORRECT — do NOT compute a per-row take), `settledAt` on a `settled` row, and make it **durable** via `after()`
   (the pattern this chunk shipped for ap2), not fire-and-forget.
5. Demo: `KERNEL_DISPATCHED_PROTOCOLS` in `apps/web/src/lib/demo-kernel-config.ts:182` (5→6) + the `/api/demo/sandbox`
   catch-all stubs for `/api/acp/{verify,settle}` + `computeDispatchPath`.
6. **Repoint the kernel unwired-fallthrough test** `packages/mcp/src/__tests__/kernel.test.ts:783` ("falls through to
   402 when the matched adapter is not wired into Phase 1") — it uses **ACP** as the unwired example (lines 795/803/806);
   point it at another still-unwired protocol (UCP, etc.) when ACP lands.
7. Tests: kernel facilitator-path (happy / proof-forward / verify-false) + the verify-core unit matrix (with **mocked
   Stripe**) + `/api/acp` route integration + the demo-config pin + the sandbox stubs.

## 5. Key files (the wire-in surface — verify line numbers, they DRIFT)
- Kernel dispatch: `packages/mcp/src/kernel.ts` — `PHASE_1_KERNEL_PROTOCOLS` (:222), the facilitator gate (:406-409),
  `handleFacilitatorProtocol`, `facilitatorVerify` (use the **function names**; the P5 doc's line numbers are stale).
- SDK adapter: `packages/mcp/src/adapters/acp.ts` (esp. `extractPaymentContext`, `validateAcpPayment`).
- App wrapper / routes: `apps/web/src/lib/acp-proxy.ts`; the new `apps/web/src/app/api/acp/{verify,settle}/route.ts`
  (mirror `apps/web/src/app/api/ap2/{verify,settle}/route.ts`).
- Env: `apps/web/src/lib/env.ts` (`isAcpEnabled`, `getAcpStripeKey`).
- Ledger writer (the spine — RECORD here, do NOT rewrite): `apps/web/src/lib/settlement/ledger.ts`
  (`recordSettlementEntry`, `recordSettlementEntryAsync`, `markSettlementSettled`, `settlementEntryId`). Durable-write
  pattern: `after()` (Next ^15.1 stable) — see `app/api/ap2/settle/route.ts` (this chunk's example).
- Demo: `apps/web/src/lib/demo-kernel-config.ts` (`KERNEL_DISPATCHED_PROTOCOLS`).
- The unwired test: `packages/mcp/src/__tests__/kernel.test.ts:783`.

## 6. ⛔ HARD GATE — deep, independent PRE-BUILD AUDIT of the build plan (MANDATORY, before ANY code)
After you write the build plan (and BEFORE writing implementation code), run a **deep, independent pre-build audit
via a dynamic workflow / agent fan-out**. It MUST confirm the plan is **comprehensive, high-quality, to-spec, that
every technical & factual assumption checks out against the ACTUAL code, and is as error-free as possible** — and it
MUST reach **PLAN_READY (0 blocking) with ALL fixes applied before implementation begins.** This is the founder
requirement; it is not optional.

**Mechanism (proven last 2 chunks — adapt `.audit/money-mechanics-prebuild/`'s script):** a `Workflow` script with
fresh-context lenses → adversarial verify → guarded synthesis:
- **Lenses (parallel, each RE-DERIVES against ACTUAL source, NOT trusting the plan):** `factual-assumptions` (every
  file:line claim + the assumptions hold — esp. the SDK/kernel wiring points + the ACP-gated Stripe reality),
  `completeness` (no under-scoped gap; the plan enumerates the test edits its changes force → a literal follow yields a
  GREEN suite in BOTH `apps/web` and `packages/mcp`; the kernel unwired-test repoint is included), `correctness-invariant`
  (the exactly-once credit invariant + the take model + the ledger write are sound; no double-count, no phantom settle,
  the dark-gate holds), and **`scope-regression`** (see §6a).
- **Adversarial verify:** each finding independently refuted by ≥1 fresh agent (default "refuted" unless a concrete code
  trace proves it real) so plausible-but-wrong findings don't survive.
- **Synthesis → verdict** `PLAN_READY` / `PLAN_NEEDS_FIXES` (+ blocking + improvements). **Apply ALL blocking fixes,
  re-run a FRESH audit (agents re-read the revised plan), repeat until PLAN_READY.**
- Use **full-reasoning agents** (NOT the search-only `Explore` agent) for review + verify. The money-mechanics
  prebuild script (`.audit/money-mechanics-prebuild/…` + the persisted workflow script) is a working copy/paste base.
  *(Heads-up: a rate-limit can interrupt a workflow mid-run; resume with `Workflow({scriptPath, resumeFromRunId})` —
  completed agents return from cache.)*

### 6a. ⚠️ Over-auditing regression guard (safeguard the spine)
A pre-build audit tends to **balloon scope** ("also fix X, also harden Y"). The **`scope-regression` lens is the spine
guard**: it must confirm the plan stays **additive/surgical** and FLAG any finding that **adds scope, new money movement,
or churn** beyond the founder's Step-0 decisions. Encode an explicit **SCOPE GUARD** section in the build plan (mirror the
money-mechanics build-plan §4): list what is byte-stable / out-of-scope (the sealed exactly-once writer core,
`markSettlementSettled`, `creditSettlement`, the orchestrators, the payout pipeline + `pricing.ts`, the on-chain
engines/verifiers, the x402 / circle-nano / money-mechanics SEAL commits). The audit's job is to make the **planned**
chunk correct — **NOT** to expand it. Treat an audit finding that grows scope as **REJECT-with-rationale**, not auto-apply.
(Last 2 chunks: every "blocking" item was a completeness/enumeration nit, never a scope expansion — that's the bar.)

## 7. Post-build SEAL panel (MANDATORY before seal)
After implementation + green gates, run a **post-build SEAL panel** (adapt `.audit/money-mechanics-postbuild/seal-panel.mjs`):
fresh-context lenses adversarially try to find a path where a real-money settle is silently enabled for the demo tool,
the ledger double-writes / under-records, the exactly-once or take invariant breaks, a byte-stable core was altered, the
dark-gate (ACP off in prod) leaks, or the kernel dispatch regressed x402/mpp/ap2/circle-nano or the forward-only
protocols. Verdict **SEAL (0 blocking)** before any commit. **The green suite is NOT sufficient** — it masked 2 blockers +
a fix-now in the A1 chunk and every hole in the x402 chunk; **independent audit is mandatory**
(cf. `feedback-ke2-independent-audit-mandatory`).

## 8. The settlement spine (BYTE-STABLE — do NOT rewrite) + the take model (do NOT re-litigate)
- **Byte-stable:** the sealed exactly-once credit machinery (`markSettlementSettled`, `creditSettlement`, the
  orchestrators' flip/return shape), the payout pipeline (`payouts/process.ts`) + the progressive take (`lib/pricing.ts`),
  the on-chain engines/verifiers, the x402 + circle-nano + money-mechanics SEAL commits. A new adapter is **ADDITIVE
  wiring**, not a spine rewrite.
- **The take model (settled last chunk — `take_bps=0` is CORRECT, not a gap):** the platform take is realized
  **progressively at PAYOUT** (`lib/pricing.ts:calculateTakeCents`, 0/2/2.5/5%); the dev is credited **GROSS** at settle.
  So a settlement row's `take_bps=0` is the honest settlement-event record — **do NOT compute a per-row take** (it would
  misrepresent the progressive payout take + risk a double-count, and a guard test forbids net-crediting the balance).
  `revenueSharePct` is legacy/ignored.

## 9. Verification gates (gates)
`cd /Users/lex/settlegrid/apps/web` then: `npx tsc --noEmit` (0) · `npx vitest run` (baseline ~4220 pass / 1 pre-existing
`processDataDeletion`) · `npx eslint <changed files>` (0) · `npx next build` (0). **PLUS** `cd packages/mcp && npx vitest
run` (the SDK suite — ACP touches the SDK; rebuild the SDK after editing it). If the settle ledger write touches the DB,
**prove it with the REAL ledger validator** (a route test that mocks the writer is insufficient — A1's lesson; the real
validator throws on a `settled` row missing `settledAt`).

## 10. Sequencing (the founder-required order)
Step-0 ACP-readiness + scope (§3) → trace + finalize scope → write the BUILD PLAN (with the §6a SCOPE GUARD) →
**PRE-BUILD AUDIT until PLAN_READY, all fixes applied (§6)** → implement surgically (single-writer) → post-build verify
(tsc / vitest BOTH packages / eslint / next build) → **post-build SEAL panel (§7)** → founder-gated local commit →
founder-gated push + (if ACP) **keep `ACP_STRIPE_KEY` UNSET in prod (dark) until OpenAI onboarding lands.**

## 11. Standing rules / guardrails (real money)
- **Single-writer core + READ-ONLY parallel verification.** Fan-out is for AUDIT (read-only) only; implement single-writer.
- **Ground every conclusion in ACTUAL tool output** — the green suite repeatedly masked holes; the pre-build audit + the
  post-build panel are the real gates.
- **A1/A2 traps:** the shared writer's `onConflictDoNothing` is FIRST-WRITE-WINS (flip via explicit `UPDATE` on
  `operation_id` + `rail`, never re-insert); dedup on `(from,nonce)` never signature bytes; a `settled` row MUST carry
  `settledAt` (validator throws otherwise).
- **Demo money-safety:** the `/demo/kernel` sandbox tool must NEVER reach a real settle — only real registered tools (the
  demo's `sg.apiUrl` points at `/api/demo/sandbox` stubs; keep it that way for ACP).
- **Prod / push are FOUNDER-GATED.** Do NOT push, do NOT set/change prod env. Commit **LOCAL-ONLY**, path-scoped (quote
  bracketed dirs, e.g. `"apps/web/src/app/api/acp/[...]/route.ts"`). `git user.name` is unset → commit with
  `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com" commit …`,
  trailer `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`.
- **Shared-worktree hazard:** parallel sessions share the working tree + index — use `git commit -- <paths>` (atomic,
  path-scoped) so a sibling's commit can't sweep your staged files.
- **Flag context degradation** the moment it risks implementation quality (founder standing order).

## 12. Out of scope (note, do not fix here unless Step-0 pulls it in)
Tier-2/3 adapters (Visa TAP / Mastercard VI / EMVco / alipay / kyapay / L402 — need partner sandboxes / infra);
Task C facilitator gas-budget circuit-breaker + the B1.4 non-Base reconciler gap (gated on the OFF public facilitator);
the `CRON_SECRET` rotation (ops hygiene); the money-mechanics deferred items not picked in Step-0 (accounts provisioning,
per-rail settlement-time take, ap2 dedup). The take model is SETTLED (§8) — do not re-open it.
