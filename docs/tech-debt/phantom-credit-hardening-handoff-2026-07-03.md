# ① BUILD HANDOFF — phantom-credit-hardening — 2026-07-03 (REVISED after the 5-lens pre-build plan audit)

**Launch-gate blocker G3-8.** Closes the confirmed financial-integrity hole where structural-only detection
credits a developer's **withdrawable** `developers.balanceCents` (`apps/web/src/app/api/proxy/[slug]/route.ts:1976-1979`)
with **no external money collected** — a balance the payout job pays out as real USD via
`stripe.transfers.create` (`payouts/process.ts:359`).

**TIER: HIGH-STAKES** (confirmed by the plan audit). Money/correctness boundary; live self-exploitable
financial-integrity bug; a launch gate; additive edit to the `route.ts` credit path (mirrors the existing
x402/circle-nano pattern). Money bug — **NOT** the honest-claims (D1) prose work (separate queued chunk).

---

## ⚠ PLAN-AUDIT REVISION LOG (READ FIRST — the original draft under-reached and invited a no-op)

A 5-lens pre-build plan audit (SEAM · LITERAL-EXECUTION · MONEY-COMPLETENESS · SCOPE/FROZEN · MONEY-CORE-INVARIANT,
all `claude-opus-4-8[1m]` @ xhigh) + an adversarial refuter materially corrected the plan. The corrections that
change what you build:

1. **THE RAIL SET IS 8, NOT 4.** Every one of the FIVE lenses independently traced that the shared credit at
   `route.ts:1976-1979` is reached by **eight** no-money rails, not four. The original named AP2/UCP/DRAIN/Visa-TAP;
   it MISSED **Alipay, EMVCo, KyaPay** (all route through the *shared* `handleProtocolProxy` alongside ucp/drain) and
   **L402** (via `handleL402Proxy`). All four are the identical DC-21 class. Gating only four leaves the hole
   half-open AND reproduces the plan's own DC-22 ("flagged-but-untracked"). **Gate all 8.** (14-adapter credit census
   confirms no 9th.)
2. **THE "MIRROR isX402SettlementEnabled" INSTRUCTION IS A NO-OP TRAP.** `isX402SettlementEnabled()` keys on real
   *capability* vars (`SETTLEGRID_GAS_WALLET_KEY && getX402PaymentAddress()`, `env.ts:201`). AP2/UCP/DRAIN/etc. have
   **no capability var — their only env vars ARE the routing-enable vars**, and `AP2_SIGNING_SECRET` **is set in prod**.
   A builder who "mirrors x402" by keying the new predicate on `AP2_SIGNING_SECRET` (or `isAp2Enabled()`) gets a gate
   that **returns true in prod → never fires → the fix does nothing, and every test passes**. This is THE most likely
   silent failure. The predicate MUST be a NEW `*_SETTLEMENT_ENABLED` var, default dark, that does **NOT** read any
   routing var (grep confirms no `*_SETTLEMENT_ENABLED` exists yet). "Mirror x402" = mirror the default-dark
   **refuse-503 SHAPE**, not its capability-var keying. See §4.2.
3. **DESIGN FORK (the #1 load-bearing decision, §4.1): enumerate-8 vs default-deny-at-the-credit-site.** Two lenses
   argue the truly-robust fix is to make the shared `:1976` credit **default-deny** (require a positive
   "real-settlement-collected" proof, as x402/circle-nano pass via `options.settlement`) so the *next* new rail can't
   re-open the hole. **DECISION (integrator, proceed on this default): gate all 8 rails now (enumerate) + footgun-guard
   the flags; TRACK default-deny as a follow-up hardening chunk** — default-deny would force ACP (a *clean real-money*
   rail on the same `forwardAndBill(…, {})` path) to pass a proof or break its real payouts, a bigger blast radius than
   a launch-gate close should carry. Operator/founder may elevate to default-deny; see §4.1.
4. **Visa-TAP money-reality is authorize≠capture.** `tap.ts` only calls `authorizeVisaPayment` (`/vts/v2/payments/authorizations`);
   there is **no capture/clearing call** anywhere. An authorization is a *hold*, not money collected — so Visa-TAP is
   phantom **even on a live Visa host**. The founder question (§9) is therefore "does a real **capture** path exist?"
   (it does not), NOT "is the host live?". Default dark.
5. **The regression test must assert `balanceCents` delta == 0, not "and/or 503".** A 503-only assertion proves a status
   code, not the invariant; `forwardAndBill` already has a `skipCredit` option that skips the credit **but still forwards
   + returns 200** (the §5.2-rejected "free proxying" shape would pass a weak test). Assert (a) `balanceCents` delta==0,
   (b) upstream NOT forwarded, (c) **run with the routing env var set** so a no-op/aliased predicate (revision #2) fails
   RED. Use the `x402-proxy-settlement.test.ts` real-`POST`-with-mocks template — NOT the source-scan
   `billing-credits.test.ts`. See §2.4.
6. **Gate placement:** UCP/DRAIN/Alipay/KyaPay/EMVCo share `handleProtocolProxy` — a "top of the handler" gate would hit
   all six; gate **per-`protocol`** (a settlement-gate map at the top of `handleProtocolProxy`, before `validate*`).
   Gate **handler-top only; do NOT touch the dispatch `enabledMap`/legacy chain** (that yields a 401 fall-through, not
   the honest 503, and doubles the surface). Handler-level placement automatically covers BOTH dispatch paths
   (unified `:447-470` + legacy `:557-602`). The Visa gate MUST sit **before** `validateVisaTapPayment` (real external
   authorize side-effect). See §2.
7. **TWO adjacent money bugs found (OUT of this chunk — ROUTED, tracked):** ACP token-replay 1:N over-credit (→ G3-9)
   and cache-hit/failover unconditional credit under a drain race (→ G3-6 family). See §12. Do NOT fold them here.

---

## 0. INTENT
Make the developer-credit boundary HONEST: `developers.balanceCents` may only be credited when the proxy actually
**collected real external money** for that invocation. Eight rails currently credit on *structural validation alone*
(self-signed JWTs / stubs / authorization-only / format-only checks) — no money changes hands, yet the credit is
withdrawable via Stripe Connect. x402 (`route.ts:2095`) and circle-nano (`:2262`) already close this; this chunk closes
the same class for the other eight. **Who consumes this:** the launch gate (G3-8); the money-integrity invariant (the
payout job draws on `balanceCents`); founder/ops (a prod-mitigation co-requisite). **What it enables:** removing a
self-exploitable fake-money-withdrawal path before promotion reactivates traffic.

---

## 1. THE CONFIRMED FINDING (grounded — 5-lens + orchestrator re-verified)

### The credit path (money boundary) — `forwardAndBill`, `route.ts:1976-1979`
On a `valid:true` detection + a 2xx from the developer's OWN upstream (`upstreamOk`), the non-defer / non-onchain
branch runs `db.update(developers).set({ balanceCents: sql\`… + ${actualCost}\` })`. No Stripe charge, no on-chain
settle, no consumer debit (consumer is the sentinel `PROTOCOL_SENTINEL_ID`), no `ledgerEntries` row.

### The withdrawal path — `payouts/process.ts`
Selects **only** `balanceCents` (`:211`), `grossCents = balanceCents` (`:259`), zeroes it (`:303`),
`stripe.transfers.create({ amount, destination: stripeConnectId })` (`:359`). (Confirmed: payout reads no other
withdrawable field — not `reservedCents`, not the settlement `accounts` ledger.) A phantom credit → real USD.

### The gate asymmetry (root cause)
Dispatch (`route.ts:447-470` unified, `:557-602` legacy) gates each rail on `isXxxEnabled()` — a **routing** gate only.
Only x402 (`:2095`, `if (!isX402SettlementEnabled()) return 503`) and circle-nano (`:2262`) additionally gate the
**credit** boundary. The other eight do not.

### The EIGHT no-money rails (all → `forwardAndBill(…, {})` → `:1976-1979`)

| Rail | Handler | Runtime on `valid:true` (no money collected) | Enabled-in-prod? |
|---|---|---|---|
| **AP2** | `handleAp2Proxy` (`:2383`) | self-issued HS256 HMAC JWT (issuer==`settlegrid.ai`), `randomUUID()` txId; no Google call (`ap2.ts:302,432`) | **YES** (`AP2_SIGNING_SECRET` set, G0-2) |
| **UCP** | `handleProtocolProxy 'ucp'` (`:2537`) | stub: any `x-ucp-session` header → valid (`ucp.ts:269-282`) | gated `UCP_API_KEY` |
| **DRAIN** | `handleProtocolProxy 'drain'` | no ecrecover — trusts `voucher.payer` (`drain.ts:314`) | gated `DRAIN_ENABLED`/`DRAIN_CHANNEL_ADDRESS` |
| **Visa-TAP** | `handleVisaTapProxy` (`:2431`) | real VTS **authorize** but **NO capture** → hold only, no money; sandbox-default host (`tap.ts:334`, no capture call) | gated `VISA_TAP_API_KEY` |
| **Alipay** | `handleProtocolProxy 'alipay'` | explicit stub, `// TODO: Call Alipay Open Platform API`, `randomUUID()` (`alipay.ts:286-304`) | gated `ALIPAY_APP_ID` |
| **EMVCo** | `handleProtocolProxy 'emvco'` | explicit stub, "spec not finalized" (`emvco.ts:274-287`) | gated `EMVCO_ENABLED` |
| **KyaPay** | `handleProtocolProxy 'kyapay'` | verifies a spend-**authorization** JWT (`max_spend_cents`); no capture — AP2 class; self-forgeable if HS256 + SettleGrid holds the key (`kyapay.ts:458-467`) | gated `KYAPAY_VERIFICATION_KEY` |
| **L402** | `handleL402Proxy` (`:2665`) | verifies SettleGrid-signed macaroon + preimage **FORMAT only** (`/^[0-9a-fA-F]{64}$/`); the real SHA256(preimage)==payment_hash check lives in the unused `verifyPayment` — proxy calls `validateL402Payment` (`l402.ts:732`, comments `:222-227`) → phantom **even with LND configured** | gated `L402_ENABLED`/`LND_REST_URL` |

**Correctly EXCLUDED (do NOT gate):** **ACP** (verifies a *paid* Stripe Checkout session — real money, `acp.ts:377`),
**MPP** (own credit path `:1521`, captures the Stripe SPT before upstream — real money), **x402/circle-nano** (already
gated), **Mastercard-VI** (always `valid:false` → 503, never credits).

**Exploit sketch (AP2 — the confirmed live one):** publish a tool whose `proxyEndpoint` you control (always-2xx),
obtain a validly-signed AP2 credential for `amount ≥ costCents`, send AP2 requests → each credits your `balanceCents`
with no money collected → withdraw via Stripe Connect. **Open exploitability question to close in build (§5 step 1):**
the self-service reachability of minting an AP2 credential (`provision_credentials`, `ap2.ts:493-496`) + the
Stripe-Connect-active barrier. Sets the severity narrative; the fix is identical regardless.

---

## 2. SCOPE — IN (the fix)

Gate the credit boundary of **all eight** no-money rails so a structural-only `valid:true` cannot credit
`balanceCents`; when the rail's settlement is dark, **refuse-and-503** (mirror x402's *shape*).

**2.1 — New per-rail settlement predicates in `lib/env.ts` (default DARK; MUST NOT read routing vars):**
```ts
// DEFAULT DARK. strict '==="true"'. These MUST NOT read AP2_SIGNING_SECRET / UCP_API_KEY / VISA_*_KEY /
// DRAIN_* / ALIPAY_APP_ID / KYAPAY_VERIFICATION_KEY / EMVCO_ENABLED / L402_ENABLED (the ROUTING vars —
// AP2_SIGNING_SECRET is SET in prod, so aliasing them makes the gate a prod no-op). "Mirror x402" = mirror
// the default-dark refuse-503 SHAPE. Setting one true ASSERTS SettleGrid collects real external money for
// that rail — NO such integration exists today for these rails; flipping it re-opens a phantom-credit path.
export function isAp2SettlementEnabled():   boolean { return process.env.AP2_SETTLEMENT_ENABLED   === 'true' }
export function isUcpSettlementEnabled():   boolean { return process.env.UCP_SETTLEMENT_ENABLED   === 'true' }
export function isDrainSettlementEnabled(): boolean { return process.env.DRAIN_SETTLEMENT_ENABLED === 'true' }
export function isVisaTapSettlementEnabled():boolean{ return process.env.VISA_TAP_SETTLEMENT_ENABLED === 'true' }
export function isAlipaySettlementEnabled():boolean { return process.env.ALIPAY_SETTLEMENT_ENABLED === 'true' }
export function isKyaPaySettlementEnabled():boolean { return process.env.KYAPAY_SETTLEMENT_ENABLED === 'true' }
export function isEmvcoSettlementEnabled(): boolean { return process.env.EMVCO_SETTLEMENT_ENABLED === 'true' }
```
(Predicate names/factoring are the builder's call — but the default-dark + no-routing-var-aliasing invariant is not.)

**2.2 — Gate placement:**
- **AP2** (`handleAp2Proxy`) + **Visa-TAP** (`handleVisaTapProxy`): a top-of-handler `if (!isXxxSettlementEnabled()) return errorResponse('… settlement is not currently available on this SettleGrid instance.', 503, 'SETTLEMENT_NOT_CONFIGURED', requestId)` — **before** any `validate*Payment` call (Visa's `validateVisaTapPayment` performs a real external authorize; a post-validation 503 would leave an external hold).
- **UCP/DRAIN/Alipay/KyaPay/EMVCo** (shared `handleProtocolProxy`): a per-`protocol` settlement-gate map at the **top** of `handleProtocolProxy`, before `validate*` — Mastercard-VI stays ungated (it 503s already):
```ts
const SETTLEMENT_GATE: Partial<Record<typeof protocol, () => boolean>> = {
  ucp: isUcpSettlementEnabled, drain: isDrainSettlementEnabled, alipay: isAlipaySettlementEnabled,
  kyapay: isKyaPaySettlementEnabled, emvco: isEmvcoSettlementEnabled,
}
const g = SETTLEMENT_GATE[protocol]
if (g && !g()) return errorResponse(`${protocol} settlement is not currently available on this SettleGrid instance.`, 503, 'SETTLEMENT_NOT_CONFIGURED', requestId)
```
- **L402** (`handleL402Proxy`): top-of-handler gate, same shape.
- **Do NOT touch the dispatch `enabledMap`/legacy chain.** Handler-level placement covers both dispatch paths and yields the honest 503 (a dispatch-level gate yields a 401 fall-through and doubles the change surface).

**2.3 — Regression test (teeth; prove-it-fails-first):** use the `apps/web/src/app/api/proxy/[slug]/__tests__/x402-proxy-settlement.test.ts` real-`POST`-with-mocks template (`vi.mock` the `@/lib/*-proxy` validators to return `valid:true`; `vi.stubEnv` the routing var; `USE_UNIFIED_ADAPTERS='false'` to route through the legacy chain). For **each of the 8** rails, with the rail's ROUTING var SET and `*_SETTLEMENT_ENABLED` unset:
  - assert **`developers.balanceCents` delta == 0** (read before/after via the mock-call count, as the x402/idempotency tests do) — NOT merely a 503; and
  - assert the upstream was **NOT forwarded** (no `fetch` to the dev endpoint) → forces the dark-gate over a `skipCredit`-style "free proxying".
  - **Prove RED first:** run the assertion pre-gate (the credit delta == `costCents`) → then add the gate → GREEN. (So write/run the test BEFORE applying the gate, or `git stash` the gate for the RED capture — the §5 sequence is test-before-gate.)
  - Positive guards (no regression): **ACP + x402 still credit**; **Mastercard-VI still 503s**.
- **§4.5 has no buggy-credit test to unwind** — no existing test pins the phantom credit as correct (validator tests assert the validator, which is frozen/untouched). Treat "update buggy tests" as a confirm-and-move-on check; do `check `proxy/[slug]/__tests__/unified-dispatch.test.ts` for any dispatch assumption the gate perturbs (it shouldn't — the gate is downstream of detection).

---

## 3. SCOPE — OUT (reject scope creep / gold-plating)
- **The D1 honest-claims demotion** (atomic-settlement G3-7 + the adapter present-tense prose) — separate queued chunk
  `detection-adapter-claims-demote`. This chunk fixes the MONEY path, not prose. (Coordinate: D1 will also touch
  `route.ts`/`[slug]` prose — sequence/rebase to avoid a collision.)
- **ACP / MPP / x402 / circle-nano / Mastercard-VI** — do NOT gate (real money or already-503). Preserve + assert.
- **Wiring REAL settlement** for any dark rail — gold-plating; the honest close is the dark-gate.
- **Default-deny-at-the-credit-site refactor** — the more robust design (§4.1) but a bigger blast radius (touches ACP);
  TRACK as a follow-up hardening chunk, do NOT fold here.
- **The two adjacent bugs (A1 ACP-replay, A2 cache-hit/failover)** — §12, routed to their own items. Do NOT fold.
- Any auth/identity change; any `forwardAndBill` refactor beyond the additive gate; touching the payout job.

---

## 4. LOAD-BEARING DECISIONS (where audit judgment concentrates)

**4.1 — [#1] enumerate-8-and-gate vs default-deny-at-the-credit-site.** DEFAULT (proceed): **enumerate — gate all 8
no-money rails** with the per-rail default-dark predicates + the footgun comment (§2.1). It closes the current hole
minimally, mirrors the blessed x402 pattern, and does not touch the clean ACP/MPP real-money paths. The alternative
(default-deny at `:1976`: credit only when the caller passes an `options.settlement`-style collection proof) is more
robust — a future rail can't re-open the hole — but forces ACP (which credits via the same `forwardAndBill(…, {})`)
to pass a proof or lose its real credits, and is a launch-risk. **Recommendation: enumerate now; TRACK default-deny as
a follow-up.** Founder/operator may elevate. Whichever is chosen, the rail set is the SAME 8 + the exclusions.

**4.2 — [#2] The no-op predicate trap (revision-log #2).** The settlement predicate MUST be a NEW `*_SETTLEMENT_ENABLED`
var, default dark, that does NOT read any routing var — else the gate is a prod no-op (AP2_SIGNING_SECRET is set) and
every test passes. The regression test MUST run with the routing var set so an aliased predicate fails RED. This is the
single most likely silent failure — verify the predicate is distinct before trusting a green gate.

**4.3 — [#3] The money-reality partition (which rails collect real money).** Gate EXACTLY the 8 no-money rails; do NOT
gate ACP/MPP (real money) or you break real payouts; do NOT miss a rail (completeness). Re-confirm each rail's
money-reality against its validator before writing the gate (§5 step 2) — this passes tests either way but is only
*correct* if it matches reality (the original miss of 4 rails is exactly this class).

---

## 5. BUILD SEQUENCE
1. **Read this handoff first.** Re-ground the credit site, the x402/circle-nano gate pattern, the 8 handlers, the
   dispatch chains, and the payout path. Close the §1 open exploitability question (a fresh-context subagent).
2. **Re-confirm the money-reality partition** (§4.3): 8 no-money rails IN; ACP/MPP/x402/circle-nano/Mastercard OUT.
3. **Add the 7 default-dark settlement predicates** (§2.1) — distinct from routing vars, footgun-commented.
4. **Add the gates** (§2.2): AP2/Visa/L402 top-of-handler (Visa before `validate*`); UCP/DRAIN/Alipay/KyaPay/EMVCo via
   the per-`protocol` map in `handleProtocolProxy`. Do NOT touch dispatch.
5. **Add the regression test** (§2.3): delta==0 + no-forward + routing-var-set, all 8 rails, prove-RED-first; ACP/x402
   positive + Mastercard 503 guards. (Write/run test BEFORE the gate to capture RED.)
6. Gate (§6). Interval self-verify with fresh-context subagents (kickoff directive (a)).

---

## 6. GATE
- From `apps/web`: `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `npx vitest run` → all pass incl. the NEW
  8-rail regression test (RED pre-gate on `balanceCents` delta, GREEN post-gate; ACP/x402 still credit; Mastercard 503).
- **Allowlist (verified in `.claude/settings.local.json`):** `Bash(npx tsc *)`, `Bash(npx vitest *)`, `Bash(npm run lint)`,
  `Bash(npm test)`, `Bash(git *)`. Env traps unset; no model pin → Opus 4.8.
- **settlegrid-repo ONLY** (no cross-repo agents edit).

---

## 7. FROZEN / DO-NOT-PERTURB
- The adapter **validators** (`packages/mcp/src/adapters/*` + the `@deprecated` `lib/settlement/adapters/*`; the latter
  is imported by `compare/nevermined/data.ts` so "dead code" is imprecise — still, do NOT change validation logic).
- **ACP/MPP** credit paths (real money) — preserve + assert.
- **x402/circle-nano** existing gates; the payout job (`process.ts`) — read-only reference.
- Do NOT un-dark any rail to make a claim true. The honest state is dark.

---

## 8. PROD-MITIGATION (OPERATOR / OPS — urgent co-requisite, parallel to the build)
The code fix defaults the rails dark on deploy, but **AP2 is live in prod NOW** (`AP2_SIGNING_SECRET` set). Recommended
immediately, independent of the build:
- **Confirm prod enablement** of AP2/UCP/DRAIN/Visa-TAP/Alipay/KyaPay/EMVCo/L402 (which routing vars are set in Vercel prod).
- **Consider parking `AP2_SIGNING_SECRET`** (like the crypto `*_PARKED` rename) to close the live AP2 vector immediately;
  the getter is fail-closed so AP2 then 503s cleanly. Weigh against any legitimate AP2 traffic (likely none pre-PMF).
- Record the confirmation in the seal / §P checklist.

---

## 9. FOUNDER / OPERATOR DECISIONS (surface; proceed on DEFAULT if no reply)
1. **Any real money-collecting integration for the 8 rails?** Default: NONE → all 8 dark-gated. If the founder confirms
   a genuine **capture/collection** path for a rail, that rail is wired/kept (only with real collection — else dark).
2. **Visa-TAP:** does a real **capture** path exist (not merely a live authorize host)? Default: no → dark. (Authorize
   ≠ capture; the code has no capture call — a live host alone still collects nothing.)
3. **Design (§4.1):** enumerate-8 now (default) vs elevate default-deny-at-credit-site into this chunk.

---

## 10. SEAL BOOKKEEPING (LAUNCH-GATE — required)
On seal, tick **G3-8 ☐→☑** in `LAUNCH-GATE-roadmap-2026-06-27.md`. Write the seal record to
**`docs/tech-debt/phantom-credit-hardening-seal-record-2026-07-03.md`**: the per-rail gate applied (all 8), the
predicate-distinctness proof, the exploitability answer (§1), the founder answers (§9), the ops prod-mitigation
confirmation (§8), and the design decision taken (§4.1). Note the two routed adjacent items (§12) are NOT closed here.

---

## 11. DEFECT-CLASS LEDGER — additions
- **DC-21 (credit-boundary asymmetry / claim-vs-MONEY-boundary).** A subset of rails gates the credit-to-withdrawable-
  balance boundary on real money collection while siblings credit on structural validation — a self-exploitable
  phantom-credit path invisible to a claims/status audit. Cue: for EVERY rail that can credit `balanceCents`, prove a
  real external settlement was collected (grep every `forwardAndBill`/credit site; the payout draws on that balance).
  Instance: 8 rails missed the x402/circle-nano gate; the original plan itself missed 4 of the 8 (the *completeness*
  sub-trap — a shared helper hides sibling rails).
- **DC-22 (flagged-but-untracked P-item).** A prior audit surfaced a potential blocker and "routed it to the owner"
  without a roadmap row → it fell out of the gate. Cue: any "route to the owner" disposition MUST create a G-row (or an
  explicit accepted-risk note) in the same pass. Instances: this bug (flagged 2026-06-28, untracked until 2026-07-03);
  the two §12 adjacent bugs are tracked immediately to avoid a repeat.

---

## 12. ROUTED ADJACENT FINDINGS (surfaced by the plan audit; NOT in this chunk — tracked so they don't re-DC-22)
Both **adversarially verified SUSTAINED** (default-refute charge). Different defect classes → their own items.
- **A1 → G3-9 (NEW, gating when ACP enabled) — ACP token-replay 1:N over-credit [HIGH·HIGH].** The ACP proxy path has
  no charge-idempotency; `validateAcpPayment` does a non-consuming GET of the paid Stripe Checkout session (no
  capture/nonce/single-use bind, `acp.ts:323-443`; contrast MPP which captures the SPT single-use, `mpp.ts:1032`). One
  $X session replays N× within the session window → N×$X credited to `balanceCents` for 1×$X collected. Fix: consume/bind
  the checkout session (unique-constraint the `acpCheckoutSessionId` or a Redis SETNX) before crediting. Direct funds
  loss the moment ACP is enabled at launch.
- **A2 → G3-6 family (NEW follow-up, triage tier) — cache-hit + failover unconditional credit under a drain race
  [MED·HIGH].** The main path's `if (collectedCents > 0)` credit gate (`route.ts:1092`, the DC-14/G3-6 hardening) was
  NOT back-ported to the cache-hit credit (`:828`) or the SLA-failover credit (`:2846`) — both credit `balanceCents`
  unconditionally even when the drain-race global-fallback CAS matched 0 rows, and *silently* (the
  `proxy.balance_race_unpaid_invocation` detector does not fire on these paths). Fix: mirror the `collectedCents>0` gate
  (check the global fallback's `.returning()`) in both blocks. Race-gated + bounded — same family as the DEMOTED G3-6;
  operator to confirm gating vs carry-with-monitoring.

---

## 13. PLAN-AUDIT SUSTAINED-FINDINGS LEDGER (for ② to confirm each was folded)
- [CRITICAL·HIGH] rail set is 8 not 4 (alipay/emvco/kyapay/l402 missed) — 5/5 lenses → §1 table, §2, RevLog#1.
- [HIGH·HIGH] no-op predicate trap ("mirror x402" → routing-var alias → prod no-op, tests pass) → §2.1, §4.2, RevLog#2.
- [HIGH·HIGH] semantic soundness / default-deny more robust than config-flag → §4.1, RevLog#3 (decision: enumerate now).
- [MED·HIGH] Visa authorize≠capture → phantom even on live host → §1, §9.2, RevLog#4.
- [MED·HIGH] test must assert balanceCents delta==0 + no-forward + routing-var-set; correct template is
  x402-proxy-settlement.test.ts not the source-scan → §2.3, RevLog#5.
- [MED·HIGH] gate per-`protocol` in shared handleProtocolProxy; handler-top only, don't touch dispatch; Visa before
  validate → §2.2, RevLog#6.
- [LOW·HIGH] §4.5 targets an empty set (no buggy-credit test; validators frozen) → §2.3.
- [LOW·HIGH] in-proxy branch/race closed by a pre-`forwardAndBill` gate; the session/hop→processSettlementBatch door is
  the DEAD G3-7 atomic path (zero runtime callers) → not a live second door; no action.
- [LOW·MED] "@deprecated dead code" imprecise (imported by compare/nevermined) → §7 seal-record precision.
- ADJACENT (routed, not folded): A1 ACP-replay [HIGH·HIGH] → G3-9; A2 cache-hit/failover credit [MED·HIGH] → G3-6 family (§12).

---

## 14. PROVENANCE
§1 facts established 2026-07-03 by: three fresh-context runtime traces (web-proxy adapter path == SDK copy; atomic
reachability; surface inventory); a 5-lens plan audit (SEAM/LITERAL/MONEY-COMPLETENESS/SCOPE-FROZEN/MONEY-CORE, all
`claude-opus-4-8[1m]` @ xhigh, each reported its model) + an adversarial refuter on the 2 adjacent findings; and the
orchestrator's own reads of `route.ts` (credit `:1976-1979`, x402 gate `:2095`, circle-nano `:2262`, dispatch
`:447-470/:557-602`, handlers), `env.ts:201` (isX402SettlementEnabled keys on capability vars; no `*_SETTLEMENT_ENABLED`
exists), `tap.ts` (authorize-only, no capture), `l402.ts:222-227/732` (format-only preimage). Line numbers verified at
HEAD 2026-07-03; re-verify before editing.
