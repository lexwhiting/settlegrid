# ② SEAL RECORD — phantom-credit-hardening (G3-8) — 2026-07-03

**Status: ✅ SEALED — ② seal-gating review PASSED; gate green; zero high/med open; operator ran `/seal-go`.**
Closes launch-gate blocker **G3-8** (DC-21 credit-boundary asymmetry). Handoff:
`phantom-credit-hardening-handoff-2026-07-03.md` (REVISED post 5-lens plan audit).
The deciding ② review is recorded in **§10** below; §1–§8 are the build's own evidence (confirmed
by ② from clean). NOT pushed — push is gated on a separate `/push-go`.

---

## 1. WHAT SHIPPED (the fix)

Dark-gated the **CREDIT boundary** of all **eight** no-money rails so a structural-only
`valid:true` detection can no longer credit the WITHDRAWABLE `developers.balanceCents`
(`route.ts:1976-1979`, paid out for real via `stripe.transfers.create` at
`payouts/process.ts:359`). When a rail's settlement is dark, it now refuse-and-503s
(mirrors the blessed x402/circle-nano SHAPE). Additive edit only — no dispatch chain,
credit site, validator, payout job, or ACP/MPP path was touched.

**Files (git diff --stat): +105 / -0**
- `apps/web/src/lib/env.ts` (+46): 8 default-dark `*SettlementEnabled` predicates.
- `apps/web/src/app/api/proxy/[slug]/route.ts` (+59): 8 import lines + 4 gate blocks.
- `apps/web/src/app/api/proxy/[slug]/__tests__/phantom-credit-settlement.test.ts` (new): the 8-rail regression test.

### Per-rail gate applied (all 8)

| Rail | Predicate (env.ts) | Gate site (route.ts) | Placement |
|---|---|---|---|
| **AP2** | `isAp2SettlementEnabled` | `handleAp2Proxy` | top-of-handler, before `validateAp2Payment` |
| **Visa-TAP** | `isVisaTapSettlementEnabled` | `handleVisaTapProxy` | top-of-handler, **before `validateVisaTapPayment`** (real external authorize) |
| **L402** | `isL402SettlementEnabled` | `handleL402Proxy` | top-of-handler, before `validateL402Payment` |
| **UCP** | `isUcpSettlementEnabled` | `handleProtocolProxy` per-`protocol` map | top of shared handler, before `validate*` |
| **DRAIN** | `isDrainSettlementEnabled` | `handleProtocolProxy` per-`protocol` map | " |
| **Alipay** | `isAlipaySettlementEnabled` | `handleProtocolProxy` per-`protocol` map | " |
| **KyaPay** | `isKyaPaySettlementEnabled` | `handleProtocolProxy` per-`protocol` map | " |
| **EMVCo** | `isEmvcoSettlementEnabled` | `handleProtocolProxy` per-`protocol` map | " |

- **Mastercard-VI intentionally ungated** (excluded from the map): always returns
  `valid:false` → 503 detection-stub already, never credits.
- **ACP / MPP NOT gated** (real Stripe money); **x402 / circle-nano** already gated.
- Handler-level placement covers BOTH dispatch paths (unified `:447-470` + legacy
  `:557-602`); the dispatch `enabledMap`/legacy chain was NOT touched (per §2.2 — a
  dispatch-level gate would yield a 401 fall-through, not the honest 503).

> **Note on the "7 vs 8" doc slip:** handoff §2.1's code snippet listed 7 predicates
> (omitting L402), but §1/§2.2/§5-step-4 all require L402 to be gated. Gating L402
> requires its own default-dark predicate, so **8** predicates shipped. Leaving L402
> out would have reproduced the exact DC-21 completeness trap the handoff warns of.

---

## 2. LOAD-BEARING DECISION #1 — NO-OP TRAP CLOSED (predicate-distinctness proof)

The single most likely silent failure (RevLog #2 / §4.2): a predicate that "mirrors
x402" by keying on a ROUTING var returns `true` in prod (`AP2_SIGNING_SECRET` IS set)
→ the gate never fires → the fix does nothing while every test passes.

**Proof (env.ts, verbatim):** every predicate reads ONLY its own distinct
`*_SETTLEMENT_ENABLED` var with strict `=== 'true'`, and reads NO routing var and NO
`is{Rail}Enabled()` routing predicate:

```
isAp2SettlementEnabled     → process.env.AP2_SETTLEMENT_ENABLED      === 'true'
isUcpSettlementEnabled     → process.env.UCP_SETTLEMENT_ENABLED      === 'true'
isDrainSettlementEnabled   → process.env.DRAIN_SETTLEMENT_ENABLED    === 'true'
isVisaTapSettlementEnabled → process.env.VISA_TAP_SETTLEMENT_ENABLED === 'true'
isAlipaySettlementEnabled  → process.env.ALIPAY_SETTLEMENT_ENABLED   === 'true'
isKyaPaySettlementEnabled  → process.env.KYAPAY_SETTLEMENT_ENABLED   === 'true'
isEmvcoSettlementEnabled   → process.env.EMVCO_SETTLEMENT_ENABLED    === 'true'
isL402SettlementEnabled    → process.env.L402_SETTLEMENT_ENABLED     === 'true'
```

**Test-enforced:** every dark-rail regression case runs with the rail's ROUTING var
SET (`AP2_SIGNING_SECRET`, `UCP_API_KEY`, `DRAIN_ENABLED`, `VISA_TAP_API_KEY`,
`ALIPAY_APP_ID`, `KYAPAY_VERIFICATION_KEY`, `EMVCO_ENABLED`, `L402_ENABLED`) and the
`*_SETTLEMENT_ENABLED` var UNSET. An aliased predicate would return true → no gate →
credit + forward → the test fails RED (confirmed: pre-gate RED capture returned 200
for all 8; see §4).

---

## 3. LOAD-BEARING DECISION #3 — MONEY-REALITY PARTITION (independently re-confirmed)

A fresh-context subagent re-confirmed each rail's money-reality against its VALIDATOR
(not the handoff). **No contradictions** — the 8 gated rails collect NO external money
on a valid detection; ACP + MPP DO capture real money (correctly excluded).

| Rail | Validator | Real money? | Reason |
|---|---|:--:|---|
| AP2 | `packages/mcp/src/adapters/ap2.ts:348` | N | self-issued HS256 HMAC VDC; sig/exp/amount/iss only, no external call |
| UCP | `ucp.ts:238` | N | stub; `// TODO: Call UCP API`, no external call |
| DRAIN | `drain.ts:467` | N | EIP-712 voucher; signature recovery **stubbed** (no ecrecover), never broadcast |
| Visa-TAP | `tap.ts:380` | N | authorize-only (`/payments/authorizations`, a hold); **no capture call** |
| Alipay | `alipay.ts:242` | N | structural stub, no fetch/capture |
| KyaPay | `kyapay.ts:336` | N | local JWT verify only; no capture/settle |
| EMVCo | `emvco.ts:221` | N | structural stub, spec not finalized |
| L402 | `l402.ts:1319` | N | macaroon HMAC + preimage **format** only; never SHA256==payment_hash, never confirms paid |
| **ACP** | `acp.ts:323/377` | **Y** | requires Stripe Checkout `payment_status==='paid'` — buyer already charged |
| **MPP** | `mpp.ts:1099/1032` | **Y** | verifies then **captures** the Stripe SPT — real funds move |

---

## 4. GATE EVIDENCE (from `apps/web`; commands pre-allowlisted)

**Primary run (this session, integrator):**
- `npx tsc --noEmit` → **exit 0**
- `npm run lint` → **exit 0, 0 errors** (only pre-existing `<img>`/hooks warnings; none in changed files)
- `npx vitest run` (full suite) → **exit 0 — Test Files 230 passed (230), Tests 5201 passed (5201)**
- New test file `phantom-credit-settlement.test.ts` → **11 passed** (8 dark-rail 503 + 3 positive guards)

**Prove-RED-first (test has teeth):** with the gate source (`env.ts` + `route.ts`)
`git stash`-reverted, the same test file returned **8 failed / 3 passed** — every dark
rail returned **200 (credit + upstream forward happened)**, the exact phantom-credit
bug; the 3 positive guards passed in BOTH states (so the RED is specifically the
missing gate, not an artifact). Stash popped → gates restored → back to GREEN.

**Each dark-rail case asserts** (per §2.3): (a) `developers.balanceCents` delta == 0
(no `db.update`/`db.transaction` credit issued), (b) upstream NOT forwarded (no
`fetch` — forces a hard refuse over a `skipCredit` "free proxy"), (c) 503
`SETTLEMENT_NOT_CONFIGURED`. **Positive guards:** ACP still forwards+credits; x402
still settles+credits (on-chain txn); Mastercard-VI still 503s via its OWN
detection-stub path (`body.code !== 'SETTLEMENT_NOT_CONFIGURED'`).

**Independent verifier (fresh-context, different agent than the gate-runner) — normalized digest:**
- `npx tsc --noEmit` → **exit 0**
- `npx vitest run <phantom-credit test>` → **exit 0, 11 passed / 0 failed / 0 skipped**. Test-id set:
  8 dark-rail cases (AP2, UCP, DRAIN, Visa-TAP, Alipay, KyaPay, EMVCo, L402 — each
  "valid detection → 503, NO credit (balanceCents delta 0), NO upstream forward") +
  3 guards (ACP forwards+credits; x402 settles+credits; Mastercard-VI 503s via own stub).
- **Predicate-distinctness:** all 8 PASS (env.ts:378–401) — each reads ONLY its own
  `*_SETTLEMENT_ENABLED` var, strict `=== 'true'`, no routing-var alias, no `is{Rail}Enabled()` call.
  Bonus wiring check: all 8 imported (route.ts:56–63) AND consumed (AP2 @2402, Visa @2461,
  L402 @2725, ucp/drain/alipay/kyapay/emvco map @2581–2590) — no defined-but-unused no-op.
- **RED re-capture** (gates `git stash`-reverted): **8 failed / 3 passed** — exactly the 8
  dark-rail cases flipped RED, the 3 guards stayed green; stash popped, state restored byte-for-byte.
- `npx vitest run` (full suite) → **exit 0, 230 files passed, 5201 tests passed, 0 failed**.
- **Verifier verdict: GREEN.** (`CLAUDE_CODE_FORK_SUBAGENT` unset → subagent ran the gate directly.)

---

## 5. §1 EXPLOITABILITY ANSWER (severity narrative)

**Realistic self-service phantom-credit at the accounting/balance layer.** For AP2 (the
rail live in prod): the credential is a self-issued HS256 HMAC JWT signed with
`AP2_SIGNING_SECRET` (a key SettleGrid holds). There is an **unauthenticated public
minting endpoint** — `POST /api/a2a/skills` with `skill:'provision_credentials'`
(`apps/web/src/app/api/a2a/skills/route.ts:66-83` → `credentials.ts:105`) signs a VDC
with the same secret, sets `iss:'settlegrid.ai'`, and accepts a caller-supplied
`amountCents` (`min(1)` only). No session/API-key auth — only per-IP rate limiting.
The validator checks sig/exp/`amount>=cost`/`iss` only (`ap2.ts:412,422`). So an
anonymous attacker registers a tool (own always-2xx endpoint), self-mints a VDC for
any amount, invokes their tool, and inflates their withdrawable balance with **zero
external money collected**.

**Withdrawal barrier:** cash-out requires an ACTIVE Stripe Connect account
(`stripeConnectStatus==='active'` + non-null `stripeConnectId` +
`balance>=payoutMinimumCents`, `payouts/process.ts:205-257,359`) — self-service but
deanonymizing (real KYC + bank + Stripe fraud controls). So the books show phantom
revenue immediately; extraction is gated at the final step by Stripe KYC. AP2 is the
highest-severity of the 8 precisely because its routing var is set in prod — which is
exactly why the gate keys on a DISTINCT `AP2_SETTLEMENT_ENABLED` var (§2).

---

## 6. FOUNDER / OPERATOR DECISIONS (§9 — proceeded on DEFAULT, no block)

1. **Real money-collecting integration for the 8 rails?** DEFAULT taken: **NONE** — the
   §3 validator re-confirm found zero real-collection path for any of the 8 → **all 8
   dark-gated.** If a founder later confirms a genuine capture/collection path for a
   rail, wire it (with real collection) and flip only that rail's `*_SETTLEMENT_ENABLED`.
2. **Visa-TAP — real capture path?** DEFAULT taken: **NO.** `tap.ts` calls authorize
   (`/payments/authorizations`) only; there is no capture/clearing call anywhere. A
   live Visa host still collects nothing → **dark.** (Authorize ≠ capture.)
3. **Design (§4.1):** **enumerate-8-and-gate** (default) shipped. `default-deny-at-the-
   credit-site` is the more robust design but a bigger blast radius (forces ACP, a
   clean real-money rail on the same `forwardAndBill(…, {})` path, to pass a proof) →
   **TRACKED as a follow-up hardening chunk, NOT folded here.** Founder may elevate.

---

## 7. OPS PROD-MITIGATION (§8 — OPS-OWNED, parallel; residual)

- The code fix defaults all 8 rails **dark on deploy** — after this ships, every rail
  503s until a real settlement path + explicit `*_SETTLEMENT_ENABLED=true` is wired.
- **AP2 was live in prod** (`AP2_SIGNING_SECRET` set). **✅ DONE 2026-07-03 (operator-confirmed):**
  `AP2_SIGNING_SECRET` **parked in Vercel and the prod instance redeployed** → the live AP2
  phantom-credit vector is closed immediately (fail-closed getter → AP2 503s cleanly), ahead
  of / independent of this code deploy.
  ⚠ REMAINING OPS RESIDUAL (non-blocking): confirm which of UCP/DRAIN/Visa-TAP/Alipay/
  KyaPay/EMVCo/L402 routing vars are set in Vercel prod (the code defaults all dark, so this
  is confirm-only, not a live vector).

---

## 8. DEFECT-CLASS / SCOPE BOOKKEEPING

- **DC-21** (credit-boundary asymmetry) instance closed for all 8 rails; **DC-22**
  (flagged-but-untracked) avoided — this was tracked as G3-8 and the two adjacent
  findings below are tracked immediately.
- **Routed adjacent findings — NOT closed here** (§12; do not conflate with G3-8):
  - **A1 → G3-9** — ACP token-replay 1:N over-credit [HIGH·HIGH]. Gates when ACP enabled.
  - **A2 → G3-6 family** — cache-hit (`:828`) + SLA-failover (`:2846`) unconditional
    credit under a drain race [MED·HIGH].
- **OUT OF SCOPE / FROZEN (untouched, confirmed):** D1 honest-claims prose demotion;
  the adapter validators (`packages/mcp/src/adapters/*`); the payout job; any
  `forwardAndBill` refactor beyond the additive gate; wiring real settlement.

---

## 9. HANDOFF TO ② (seal-gating review) — ✅ DISCHARGED (see §10)

## 10. ② SEAL-GATING REVIEW — the deciding review (2026-07-03) — ✅ SEALED

Independent, hostile, fresh-context review of the BUILT diff (the review that decides the seal).
Integrator = main session (no self-seal; operator ran `/seal-go`).

**Gate re-confirmed from clean (integrator, isolated run, cwd apps/web):** `tsc --noEmit` exit 0 ·
`npm run lint` exit 0 (0 errors; only pre-existing `<img>`/hooks warnings) · `vitest run` **230 files /
5201 tests passed, exit 0** — reproduces the build's reported digest exactly. Not an evidence-free green.

**Tier re-confirmed HIGH-STAKES, NOT escalated:** realized diff is purely additive (+105/-0), no frozen
surface touched (validators / dispatch chain / credit site / payout / ACP-MPP all untouched), matches
the handoff spec. env traps unset; allowlist GREEN (gate + repros foreground); Path-1 pool absent.

**Fan-out (5 lens-distinct fresh-context reviewers, all `claude-opus-4-8[1m]`, via a single workflow):**
money-core-invariant · spec-conformance/completeness · SEAM · literal-execution/test-teeth ·
security-boundary/no-op-trap+predicate-distinctness. Verdicts: **4 SEAL-CLEAN + 1 FINDINGS (LOW/INFO
only)**. **ZERO high/med findings on the moat.** *Effort caveat (recorded):* all 5 agents self-reported
`effort=high` although the workflow `agent()` calls requested 1×`max` (money-core) + 4×`xhigh`; the
per-agent-effort **self-report is model-unreliable** (documented prior), so this was a coverage
*uncertainty* on the money-core lens, not a confirmed downgrade — resolved next.

**Definitely-max money-core re-pass (Path-2):** operator switched the session to `/effort max`; a fresh
Agent-tool spawn (inherits the now-max SESSION effort — unambiguous, no reliance on the uncertain
workflow param; Read/Grep only) ran a deep hostile pass. **VERDICT: MOAT-INTACT.** It independently
enumerated EVERY `developers.balanceCents` writer in the whole repo (route.ts ×6 + sdk/meter ×2 +
metering + billing/webhook + cron/process-payouts + payouts/process + reconcile + sessions) and proved
none is reachable by the 8 rails on structural-only input (each needs a real API key + consumer debit,
real-money capture, a Stripe-webhook signature, cron auth, `RECONCILABLE_RAILS`, or has no live caller);
confirmed the gate is the first/unconditional statement in all 4 handlers; confirmed both dispatch paths
route the 8 rails to the gated handlers; confirmed `validateMastercardPayment` has NO `valid:true` path
(deliberate map omission safe); confirmed no over-gating (ACP/MPP/x402/circle-nano untouched, still credit).

**Live fail-then-pass reproduction (the seal's filter — integrator, real POST-with-mocks test):**
gate source (`env.ts` + `route.ts`) `git stash`-reverted → **8 failed / 3 passed** (every dark rail
returned **200**: credit + upstream forward = the exact phantom-credit bug); stash popped → **11/11
passed**. The teeth are real and gate-specific.

**Findings — all adjudicated, NONE blocking (zero high/med open):**

| # | Sev/Conf | Item | Disposition (verified) |
|---|---|---|---|
| 1 | INFO/high | `/api/ap2/settle` (2nd AP2 entry, gated only by `isAp2Enabled`) writes a phantom `rail='ap2' status='settled'` `ledger_entries` row on a self-minted VDC | **Verified AUDIT-ONLY** — `recordSettlementEntry` (`ledger.ts:411`) does `db.insert(ledgerEntries)` only; never `developers.balanceCents`; `ap2 ∉ RECONCILABLE_RAILS=['circle-nano','x402']`, and `creditSettlement`'s only 2 callers are rail-gated → an ap2 row is never promoted. Out of G3-8 scope (pre-existing P3.K4 debt, `a1-facilitator-ledger-writes`). **ROUTED residual (ledger-honesty).** |
| 2 | INFO/high | `processSettlementBatch` (`sessions.ts:668`) is an unauth client-`costCents` credit engine that would write `developers.balanceCents` | **Verified DEAD** — no live caller; `finalizeSession` stops at a `status:'pending'` batch; only route `/api/sessions/[id]/finalize` stops there. = the known **dead G3-7 atomic path** (handoff §13, "zero runtime callers"). **ROUTED residual** (a latent, unauth, one-wire-up-from-live credit engine — worth its own audit before the session-settlement path is ever wired). |
| 3 | LOW/high + INFO/low | Regression test exercises only the LEGACY dispatch path (`USE_UNIFIED_ADAPTERS='false'`), not the prod-DEFAULT unified path | Gate **verified path-independent** (3×: integrator + 2 lenses traced `tryUnifiedAdapterDispatch:449-478` → same gated handlers; the unified detect side is side-effect-free). Fix sound on both paths today; the gap is a *future-divergence* guard. **Test-hardening FAST-FOLLOW** (a unified-path case needs the real `@settlegrid/mcp` registry, not the mocked detects). |
| 4 | INFO/med | `SETTLEMENT_GATE` is `Partial<Record<...>>` → a FUTURE no-money protocol added to the `handleProtocolProxy` union without a map entry passes ungated with no tsc error | Not a current defect (all 5 no-money protocols mapped; mastercard-vi correctly omitted + 503s via its stub). A total `Record<...>` with an explicit entry for mastercard-vi would fail-closed at compile time. **DC-21 hardening NOTE** (defense-in-depth for the next rail). |
| 5 | INFO | Mastercard-VI guard's `body.code` assertion is vacuous (stub body has no `code`); x402/circle-nano dark-gates sit AFTER `lookupToolBySlug` (safe — read-only, no side-effect); per-protocol 503 message interpolates the lowercase protocol value | Redundant/cosmetic. The Mastercard guard's real teeth is the sibling `expect(mcStub).toHaveBeenCalledTimes(1)`. Notes only. |

**Seal decision:** gate green · zero high-severity open · reviewers' evidence + the definitely-max moat
pass + live RED→GREEN teeth support it → **CLEAR TO SEAL**. Operator ran `/seal-go`; integrator did the
explicit-pathspec commit + this bookkeeping (no self-seal). ② review adds **no new SEAM /
LITERAL-EXECUTION code recurrence** (both standing lenses cleared; their findings were test-hygiene, not
executable defects).

**Routed residuals (NOT closed here — tracked so they don't re-DC-22):**
- **AP2-settle ledger honesty** (F1) — a `'settled'` audit row for a payment that collected nothing;
  latent (would matter only if a future change adds `ap2` to `RECONCILABLE_RAILS` or wires
  `accounts→developers` off `ledger_entries`). Adjacent to DC-21 but a distinct *ledger-honesty* class.
- **`processSettlementBatch` unauth credit engine / dead G3-7 atomic path** (F2) — audit before any
  session-settlement wire-up.
- **Unified-path regression coverage** (F3) — test-hardening fast-follow.
- **`Partial<Record>` → total `Record` exhaustiveness** (F4) — cheap DC-21 defense-in-depth.

---

## 11. HANDOFF TO ③ (post-seal deep audit) — high-stakes ⇒ ③ WARRANTED

Sealed commit: **`8e3e0f79`** (local, UNPUSHED — `/push-go` gated). Base `origin/main = 52baad7c`.
② scoped the BUILT diff only; ③ audits the **integrated whole** — the credit boundary as a system.

**Where ③ should hunt hardest (② could not see past the diff):**
1. **The two routed residuals as live-system questions, not just tickets.** (a) `/api/ap2/settle`'s
   phantom `rail='ap2' status='settled'` ledger row — trace whether ANY current-or-near path promotes a
   ledger_entries row to a withdrawable balance (re-confirm `RECONCILABLE_RAILS` is the only gate, and
   that reconcile/payout can't be steered to ap2). (b) `processSettlementBatch` — the dead-but-present
   unauth client-`costCents` credit engine (dead G3-7 atomic path): is it truly caller-less, and what
   would wiring the session-settlement path expose?
2. **Completeness across the whole surface, not just the proxy route.** ② confirmed the 8 proxy rails +
   the money-reality partition. ③ should re-run the credit-boundary census system-wide: every
   `developers.balanceCents` / `accounts.balanceCents` writer, every `/api/*/settle` + facilitator +
   webhook + cron + session route, against the DC-21 cue "for EVERY rail that can credit, prove a real
   external settlement was collected."
3. **The prod-default UNIFIED dispatch path end-to-end** (② proved the gate is path-independent by code
   trace; the regression test pins only legacy). Confirm no unified-only divergence.
4. **Config-reality:** the gate defaults all 8 rails dark on deploy, but confirm no prod
   `*_SETTLEMENT_ENABLED` is set anywhere (Vercel), and that AP2's routing var parking (§7) holds.

**FROZEN (do not perturb without re-review):** the adapter validators (`packages/mcp/src/adapters/*`),
the dispatch chain (`enabledMap`/legacy), the credit site (`forwardAndBill:1985`), `payouts/process.ts`,
and the ACP/MPP/x402/circle-nano real-money paths. The G3-8 gate is additive on top of these.

**Adjacent items already tracked (do NOT fold into ③ of G3-8):** A1→G3-9 (ACP replay, deferred to ACP
go-live), A2→G3-10 (cache-hit/failover, operator-confirmed carry), D1 honest-claims prose
(`detection-adapter-claims-demote`). Plus the 4 §10 routed residuals.
