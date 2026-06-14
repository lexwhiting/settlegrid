# V-N1 (+V-N3) — `validBefore` upper-bound cap — ① BUILDABLE HANDOFF (2026-06-14)

> Standalone, self-contained handoff for the FRESH build session. Supersedes the PREP stub
> (`v-n1-validbefore-cap-PREP-2026-06-14.md`) — the PREP's grounding questions are all now ANSWERED below
> (grounding done + founder policy ratified 2026-06-14). A builder should be able to work entirely from
> this file. HIGH-STAKES, real-USDC Base-mainnet prod, local-build cadence — **never push without explicit
> founder say-so.** Repo: `/Users/lex/settlegrid` (pnpm monorepo: `apps/web` + `packages/mcp`).

---

## 0. Decision, tier, founder answers (RATIFIED 2026-06-14)

- **Chunk:** V-N1 (cap `validBefore` at both verifiers + new buyer-facing reject) **bundled with V-N3**
  (GDPR posture for `ledger_entries`). Source-of-truth register: `docs/tech-debt/s-deep-audit-register-2026-06-10.md`
  lines 136 (V-N1), 153 (V-N3), 135 (priority).
- **Tier:** HIGH-STAKES. Adds a buyer-facing contract (new 402 reject), touches an anti-abuse/correctness
  boundary (unbounded `validBefore` → immortal `pending`), and a PII/compliance boundary (V-N3).
- **Founder policy answers (all ratified — these are FROZEN inputs to the build):**
  - **Q1 — cap value:** `MAX_VALIDBEFORE_WINDOW_SECONDS = 3600` (**1 hour**).
  - **Q2 — retroactivity:** **verify-time only** this chunk. The cap is the root fix for all NEW rows.
    Existing over-cap rows (if any) are left for a founder-gated follow-up, gated on a prod count (§5).
  - **Q3 — reject code name:** `VALIDBEFORE_TOO_FAR`. Concretely (one per surface's convention):
    `CIRCLE_NANO_VALIDBEFORE_TOO_FAR`, `X402_VALIDBEFORE_TOO_FAR`, `AUTHORIZATION_VALIDBEFORE_TOO_FAR` (§3).
  - **V-N3:** **document the financial-retention exemption** (lawful-basis doc; no erasure code this chunk) (§6).

---

## 1. The problem (grounded)

Both verifiers reject EXPIRED authorizations but do NOT cap a far-FUTURE `validBefore`:
- `apps/web/src/lib/settlement/circle-nano/verify.ts:181` — `if (nowSec > validBefore) reject('CIRCLE_NANO_EXPIRED')`. No upper cap. (Offline, RPC-free; the shared verifier used by BOTH circle-nano AND the x402 settle orchestrator.)
- `apps/web/src/lib/settlement/x402/verify.ts:296` — `if (now > validBefore) reject('AUTHORIZATION_EXPIRED')`. No upper cap. (On-chain reads; used by the public facilitator `/v1/verify` + the internal verify route.)

A buyer can mint a ref-NULL `pending` row with `validBefore` = year 2099 that **never wall-expires**. The
reconciler expiry pass's wall-clock pre-filter is `now ≤ vb + EXPIRY_MARGIN_SECONDS (300) → skip`
(`reconcile.ts:571`) — so a far-future `vb` is skipped **forever** → permanent `pending_overdue` /
`noTxhashCount` inflation (the alarm-fatigue (V) only half-closed) AND permanent indexed payer-PII (the V-N3
surface). Rate limits bound the RATE; nothing bounds ACCUMULATION. **Fix:** reject
`validBefore > now + MAX_VALIDBEFORE_WINDOW_SECONDS` with a new buyer-facing 402 code, at BOTH verifiers.

---

## 2. The cap VALUE — grounding for `3600s` (1 hour)

**Where `validBefore` is SET (the legit window):** The SDK adapters
(`packages/mcp/src/adapters/circle-nano.ts:474-489`, `x402.ts:456-472`) only *validate* `validBefore` (a
best-effort expiry check — "the server re-checks authoritatively"). They never SET it. The **buyer's wallet**
sets it. The seller-side anchor SettleGrid advertises is `X402_MAX_TIMEOUT_SECONDS = 300`
(`packages/mcp/src/adapters/x402.ts:52`, surfaced as `maxTimeoutSeconds` in the 402 challenge at lines
212 + 595). A protocol-compliant x402 buyer sets `validBefore ≈ now + 300`.

**What the legit window must survive (settlement timing, all grounded):**
- Gas wallet broadcasts `transferWithAuthorization` at settle time; Base mines in ~2 s; receipt wait
  `RECEIPT_TIMEOUT_MS = 30_000` (`circle-nano/settle-engine.ts:46`; x402 `SETTLE_RECEIPT_TIMEOUT_MS = 30_000`
  at `x402/settle.ts:99`).
- The reconciler cron is `*/15` (`apps/web/vercel.json`). It does **NOT** re-broadcast ref-NULL rows — it
  *terminalizes / quarantines* them (it is the death-prover, not a re-settler — `reconcile.ts:404-431`).
- `EXPIRY_MARGIN_SECONDS = 300` (`reconcile.ts:431`) + safe-head lag (Base `safe` trails `latest` ~5-10 min)
  are on the **terminalization** side (how long AFTER expiry we wait before declaring death), NOT the
  legit-window side.

**Therefore:** a legit `validBefore` only needs to cover a single settle attempt (seconds) plus buyer
retries within their own window — it does NOT need to survive the reconciler lifecycle. The advertised 300 s
is already generous; `3600 s` is 12× that.

**Why 3600 s and not tighter / looser:**
- **Asymmetry favors generous.** On a real-USDC rail, false-rejecting a legitimate payment (lost sale + buyer
  confusion) is the worst outcome. An over-cap row's only cost is that it stays `pending` ~`MAX_WINDOW` before
  terminalizing — it is NOT immortal. So the downside of "too generous" is tiny; the downside of "too tight"
  is a 402 on a good payment. 1 h gives huge headroom for clock skew, buyer-added buffers, and non-canonical
  clients. **Clock-skew direction (explicit):** the cap compares the BUYER-set `validBefore` against the
  SERVER clock `nowSec` (`circle-nano/verify.ts:134`, `x402/verify.ts:280`), so a false-reject requires the
  buyer's clock to LEAD the server's by more than `MAX_WINDOW − buyer's-own-window`; for a protocol-compliant
  300 s buyer under a 1 h cap that is >55 min of lead — implausible.
- **Do NOT loosen to 6 h.** The `pending_overdue`/`noTxhashCount` alarm fires at `overdueAfterMs = 6 h`
  (`reconcile.ts:775`). A 6 h cap would let an abuse row survive ~6.5 h and CROSS that threshold — re-inflating
  the very signal V-N1 protects. 3600 s sits correctly between the 300 s legit anchor and the 6 h alarm. (Audit-derived.)
- **Kills the abuse.** A 2099 authorization is rejected at verify → no immortal row ever created. The worst an
  attacker can still do is `validBefore = now + 3600`, which wall-expires in ≤1 h; the reconciler then
  terminalizes it (`now > vb + 300`, chain-anchored). Max `pending` lifetime drops from ∞ → ~1 h + reconciler lag.
- The cap is an **anti-abuse** bound, NOT a protocol-conformance gate. The chain would settle a `now+3600`
  authorization fine, so capping AT the advertised 300 s would be needlessly strict.

**One shared constant (DC-07).** Define `MAX_VALIDBEFORE_WINDOW_SECONDS = 3600` in ONE place and import it at
both verifiers. Recommended home: `apps/web/src/lib/settlement/x402/types.ts` (circle-nano/verify.ts already
imports `USDC_ADDRESSES` from there, and that file already holds value constants — no new file needed). The
build may instead create `apps/web/src/lib/settlement/constants.ts`; either way there must be exactly ONE
literal `3600`, imported at both `verify.ts` files — never two copies (DC-07 multi-surface drift).

---

## 3. Exact surfaces to change (file:line) — the full DC-07 multi-surface map

The cap LOGIC lands in 2 verify functions, but the new-code CONCEPT touches **5 surfaces**. Miss one → drift.

1. **`apps/web/src/lib/settlement/circle-nano/verify.ts`** — add the cap check immediately AFTER the expiry
   check (after line 187, `CIRCLE_NANO_EXPIRED`). Already parses with strict `BigInt` (line 165), so `validBefore`
   is a clean `bigint` here. Add:
   `if (validBefore > nowSec + BigInt(MAX_VALIDBEFORE_WINDOW_SECONDS)) return { valid:false, errorCode:'CIRCLE_NANO_VALIDBEFORE_TOO_FAR', invalidReason: '…' }`.
   Place it AFTER not-yet-valid + expired (consistent ordering: time-window family together) and BEFORE the
   amount/crypto checks (cheap structural reject first).
2. **`packages/mcp/src/adapters/circle-nano.ts:253`** — add `'CIRCLE_NANO_VALIDBEFORE_TOO_FAR'` to the
   `CircleNanoErrorCode` union (the verifier imports this type — cross-package change; `packages/mcp` must build).
3. **`apps/web/src/lib/settlement/x402/verify.ts`** — add the cap check in `verifyExactPayment` immediately
   AFTER the expiry check (after line 305, `AUTHORIZATION_EXPIRED`) and BEFORE the on-chain nonce/balance
   reads (so an over-cap auth rejects without spending an RPC call). Return
   `errorCode:'AUTHORIZATION_VALIDBEFORE_TOO_FAR'`. **See §4 — this verifier parses with `parseInt` (NaN/precision
   footgun); the cap must sit behind a strict parse or it is bypassable.**
4. **`apps/web/src/lib/settlement/x402/types.ts:111`** — add `'AUTHORIZATION_VALIDBEFORE_TOO_FAR'` to the
   `X402VerifyErrorCode` union.
5. **`apps/web/src/lib/settlement/x402/orchestrate.ts:117`** — the x402 **settle** orchestrator calls the
   SHARED circle-nano verifier and REMAPS its `CircleNanoErrorCode` → an x402 outcome code in
   `verifyFailureOutcome`. Add `CIRCLE_NANO_VALIDBEFORE_TOO_FAR: { code: 'X402_VALIDBEFORE_TOO_FAR', httpStatus: 402 }`.
   Without this entry an over-cap x402-settle auth falls through to the generic `X402_SETTLEMENT_FAILED`
   default (still 402, but an imprecise code → DC-15/DC-07 contract drift).

> Line numbers in this section are approximate — LOCATE BY CONTENT (symbol/string), not line (audit note).

**Passthrough accounting (audit-corrected — the new code is structured on SOME surfaces, generic on others):**
- circle-nano `/settle` + `/verify` surface the `CircleNanoErrorCode` directly with `httpStatus 402` (the
  settle path returns the verify `errorCode` verbatim, e.g. `circle-nano/settle.ts:234`). So
  `CIRCLE_NANO_VALIDBEFORE_TOO_FAR` reaches the buyer as a 402 there automatically.
- The x402 facilitator `/v1/verify` (`…/facilitator/v1/verify/route.ts:96`) and the internal x402 `/verify`
  route (`…/x402/verify/route.ts:64`) — BOTH route through the SAME `verifyExactPayment` (no second
  exact-verify impl) and return its `{isValid:false, errorCode}` envelope (HTTP 200, x402-spec read-only
  shape) — the new `AUTHORIZATION_VALIDBEFORE_TOO_FAR` surfaces as a structured code there automatically.
- The x402 settle orchestrator → proxy path surfaces `X402_VALIDBEFORE_TOO_FAR` (the new `verifyFailureOutcome`
  map entry, surface 5) as the buyer's HTTP 402 (`X402SettlementOutcome.code` is a FREE string consumed by
  `proxy/[slug]/route.ts` `x402Error(outcome.code,…)` — no extra type declaration needed).
- ⚠ **BUT** the two STANDALONE settle routes `…/x402/settle/route.ts:79` and `…/facilitator/v1/settle/route.ts`
  call `verifyExactPayment` then return `errorResponse(invalidReason, 402, 'PAYMENT_VERIFICATION_FAILED')` —
  they COLLAPSE every verify code (the existing `AUTHORIZATION_EXPIRED` too) into the generic
  `PAYMENT_VERIFICATION_FAILED`, surfacing the new code only inside the human `invalidReason` text. This is
  PRE-EXISTING behavior (NOT a V-N1 regression) — flagged for honesty; no change required this chunk.

**Out of scope (do NOT add the cap here):**
- The SDK adapters' best-effort expiry checks (`packages/mcp/.../circle-nano.ts:484`, `x402.ts:467`) are
  explicitly "best-effort; the server re-checks authoritatively." The cap is authoritative at the two SERVER
  verifiers only. Mirroring it into the published SDK is OPTIONAL polish, NOT in this chunk (avoids a
  published-SDK behavior change).
- **Permit2 `deadline` (`verifyUptoPayment`, `x402/verify.ts:395`)** is the SAME uncapped-upper-bound pattern
  (and the same `parseInt` footgun) — but the `upto`/Permit2 path is VERIFY-ONLY (`parse.ts:58`
  `if (o.scheme !== 'exact') return null` → it never settles, never creates a pending row), so it is NOT an
  immortal-row vector. Left uncapped this chunk. NOTE the residual: the public facilitator `/v1/verify` would
  report a far-future Permit2 `deadline` as `isValid:true` while capping the equivalent EIP-3009 `validBefore`
  — a verdict-INCONSISTENCY across two facilitator endpoints (DC-07). Flagged as a verify-consistency
  follow-up; do NOT silently ignore, do NOT expand V-N1 scope to it.
- **SDK API note (DC-15):** `CircleNanoErrorCode` is a PUBLISHED `@settlegrid/mcp` export (`packages/mcp/src/index.ts`).
  Adding the union member is an ADDITIVE, non-breaking public-API change — note it in the SDK changelog/register.

---

## 4. DC-12 robustness — the cap must be TOTAL  (audit-resolved 2026-06-14)

- **The x402 parse hole (must fix as part of the cap, or the cap is bypassable).** `x402/verify.ts:283-284`
  parses with `parseInt(authorization.validBefore, 10)`. `parseInt('abc', 10) → NaN`; `now > NaN` and
  `now < NaN` are both `false`, so a non-numeric `validBefore` passes BOTH time checks today, AND
  `NaN > now + MAX` is `false` so it would bypass the new cap. **DECISION (audit-confirmed): unify the x402
  parse on strict `BigInt`** (matches circle-nano's verify AND the metadata writer at `orchestrate.ts:170`,
  which already does `BigInt(proof.authorization.validBefore).toString(10)`), failing closed on a
  non-canonical string. The audit enumerated every `parseInt → BigInt` divergence and confirmed each is
  fail-CLOSED or strictly-more-correct (never a new mis-accept) — so the BigInt unification is the right call;
  do NOT use the narrow dual-parse fallback (two parses in one function is itself a drift smell).
- **⚠ HIGH (audit) — converting to BigInt forces `now` to BigInt TOO, or the function throws.** `now` is a
  `number` (`verify.ts:280`). The expired/not-yet-valid branches do message arithmetic `validAfter - now`
  (`:287`) and `now - validBefore` (`:297`); `bigint - number` throws `TypeError` (verified). That throw is
  swallowed by the function-wide `try/catch` (`:254`/`:357`) → returns `VERIFICATION_RPC_ERROR` instead of the
  correct `AUTHORIZATION_EXPIRED`/`AUTHORIZATION_NOT_YET_VALID`, and breaks the reason-string asserts at
  `apps/web/src/lib/__tests__/x402.test.ts:416-428`. **Build sub-step (explicit, not discovered-at-gate):** set
  `const now = BigInt(Math.floor(Date.now()/1000))` and audit EVERY downstream use of `now`/`validAfter`/
  `validBefore` arithmetic + interpolation. Done right the arithmetic becomes bigint-bigint, whose template
  interpolation yields the SAME digit strings (`${300n}` → `"300"`), so tests 416-428 still pass — VERIFY this,
  don't assume. (The comparisons `now > validBefore` etc. are safe either way: `number > bigint` is legal JS.)
- **Divergence enumeration the build must NOT "fix back" (audit):** vs `parseInt(_,10)`, `BigInt` accepts
  hex/octal/binary (`'0x10'→16`) and treats `''`/whitespace as `0` (not NaN). Hex acceptance is INTENDED and
  already depended on — `orchestrate.test.ts:357` (R-V7-hex) feeds `validBefore:'0x2540BE3FF'` and expects it
  stored as decimal `9999999999`. Empty/whitespace `→ 0` is fail-CLOSED (`now > 0` → EXPIRED reject). Truly
  non-numeric (`'abc'`, `'1e3'`, `'100abc'`, `'12.9'`) → BigInt THROWS → caught → reject (fail-CLOSED; closes
  today's parseInt fail-OPEN holes). Posture to encode: non-canonical → fail-closed reject; hex tolerated.
- **`validAfter` vs `validBefore` interplay → DEFER (audit-resolved, do NOT add a guard).** Exhaustive
  enumeration over all orderings of (validAfter, validBefore, now) shows strictly-degenerate windows
  (`validBefore < validAfter`) produce ZERO accept cases — every one is already caught by not-yet-valid or
  expired. The only window where `vb ≤ va` accepts is the LEGITIMATE single-instant `vb == va == now`. So a
  `validBefore <= validAfter → reject` guard would FALSE-REJECT that legit instant, and a `validBefore <
  validAfter` guard is provably dead code. **Verdict: document as already-covered; add no guard.**
- **Overflow:** `BigInt` is arbitrary-precision (no overflow). `validBefore > nowSec + BigInt(MAX)` is exact.
  Define `MAX_VALIDBEFORE_WINDOW_SECONDS` as a `number` literal so `BigInt(MAX)` is unambiguous.
- **Boundary (audit-confirmed):** the cap is `validBefore > now + MAX` → `== now + MAX` PASSES (inclusive),
  consistent with the existing strict-`>`/`<` time-window family. Inclusive is the safe choice (the §2
  asymmetry favors letting the exact boundary through). The new ACCEPT-at-`now+MAX` / REJECT-at-`now+MAX+1`
  boundary pair (§7) guards it.

---

## 5. Retroactivity (Q2 = verify-time only this chunk)

**Why it matters:** the verify-time cap stops NEW abuse but does NOT touch rows ALREADY in the DB with a
far-future `validBefore`. Confirmed immortal: `validBefore` is stored in `metadata.validBefore` (string,
written via strict `BigInt(...).toString(10)` at `orchestrate.ts:170` + `circle-nano/settle.ts` refresh); the
expiry pass reads `meta?.validBefore` (`reconcile.ts:556-568`) then hits the wall-clock pre-filter
`now ≤ vb + 300 → skip` (line 571) — so a 2099 row skips forever. Quarantining such a row would NOT help: per
`reconcile.ts:428-430` quarantined rows STAY visible in `pending_overdue`/`noTxhashCount`, so the alarm stays
inflated. Cleaning existing rows would require BOTH a quarantine class AND a change to the alarm predicate to
exclude that class — i.e. it touches the alarm + (optionally) the V-N4-sealed reconciler. That is deliberately
OUT of V-N1.

**✅ PROD COUNT RUN 2026-06-14 — follow-up is MOOT (not merely deferred).** The founder ran the predicate +
a ROLLUP census against the prod DB (host `db.ncqjvmpruutwhilldcjp.supabase.co` — confirmed prod, not the
local `:5433` Docker PG): `over_cap = 0`, AND the census grand total is `n = 0` — **`ledger_entries` is
entirely EMPTY in prod** (no settlement rows on any rail yet; pre-volume). So there is no existing over-cap
population, and **as long as the V-N1 verify-time cap ships BEFORE any real x402/circle-nano settlement volume
accrues, a pre-cap over-cap population can never form** → no cleanup chunk is needed at all. **Re-check
trigger (the ONLY one):** if settlement traffic begins on prod BEFORE the cap ships, re-run
`/tmp/vn1_overcap_count.sql` at ship time before closing this gate. The mechanics below are retained for that
contingency.

**This chunk ships verify-time only.** It is the root fix (NEW rows can never become immortal). For the
follow-up (now MOOT per the prod count above, unless the re-check trigger fires):
- **The founder action (manual, prod):** count existing over-cap rows. The detectable predicate (no `validBefore`
  column; it's in jsonb metadata):
  `SELECT count(*) FROM ledger_entries WHERE settlement_status='pending' AND external_ref IS NULL AND rail IN ('x402','circle-nano') AND (metadata->>'validBefore')::numeric > extract(epoch FROM created_at) + 3600;`
  (Audit-confirmed sound: `metadata.validBefore` is a canonical decimal string so `::numeric` casts cleanly;
  `created_at` is `defaultNow()` set at INSERT, i.e. ≥ the verifier's `now`, so it is a slightly LOOSER anchor
  than the cap used — intentionally conservative: every legit created row has `vb ≤ verify_now+3600 ≤
  created_at+3600` and so NEVER trips the predicate, while NULL `validBefore` legacy rows are excluded by
  `NULL::numeric`. The predicate catches ONLY genuine pre-cap over-cap rows.) If the count is ~0 (abuse never
  exploited), no cleanup chunk is needed. If non-trivial, a follow-up quarantines them with a new `expiryClass`
  AND extends the `pending_overdue`/`noTxhashCount` predicate (`reconcile.ts:860-873`, no `expiryClass` filter
  today) to exclude that class.
- The build must NOT attempt this cleanup. Record it in the register / ledger as the V-N1 follow-up.

**⚠ Re-warn the founder on the register wording (audit).** The register calls V-N1 the "Root fix of the
immortal-row + PII clusters." That is true for NEW rows (the class can no longer recur), but for EXISTING rows
BOTH halves persist: existing over-cap rows stay immortal in `pending_overdue` AND their payer PII stays
permanently indexed until the deferred cleanup + the V-N3-erasure chunk. The prod-count above gates BOTH
follow-ups. Do not let the "root fix" wording read as "the existing clusters are resolved."

---

## 6. V-N3 (= document the financial-retention exemption)

**Surface (confirmed):** the payer EVM address is written into TWO indexed places on every settlement row:
`operation_id = {rail}:{network}:{payer_addr}:{nonce}` (`circle-nano/settle.ts:80-82`,
`x402/orchestrate.ts:104-106`) AND `metadata.payer = authorization.from` (`circle-nano/settle.ts:111`,
`x402/orchestrate.ts:157`). The `data-retention` cron purges 6 tables (invocations, webhook_deliveries,
audit_logs, tool_health_checks, conversion_events, compliance_exports) — confirmed **zero `delete(ledgerEntries)`
tree-wide**. `operation_id` is the load-bearing dedup/idempotency key (used in `eq(ledgerEntries.operationId, …)`
lookups + the deterministic-id ON CONFLICT writer) — anonymizing it is entangled with the money rails, which
is WHY erasure is not rushed into this chunk.

**Third PII surface (audit-added):** the public facilitator `/v1/verify` RESPONSE echoes the payer address
(`verify.ts` returns `payer: authorization.from` on every branch, e.g. `:274/292/356`). This is a TRANSIENT
response echo (the x402-spec read-only shape), not persistence — but the V-N3 inventory must name it.
Affirmatively confirmed CLEAN: NO `logger`/Sentry call in the settlement tree logs the payer address (grep =
0 hits) — so the PERSISTENCE surfaces are exactly two (`operation_id`, `metadata.payer`), which is what an
erasure design must target.

**⚠ This chunk = document the GAP, NOT assert an exemption (audit-RESOLVED — DEFAULT-STOP).** The pre-build
audit READ `docs/legal/privacy-notice-draft.md` + `apps/web/src/lib/settlement/compliance.ts` and found the
existing financial-retention exemption does **NOT** cover anonymous on-chain payers: the privacy notice §2
scopes data subjects to **Developers** and **Customers** only (§3.1 inventory was derived from the
`developers` table + related tables); there is NO anonymous-payer concept; the account-less erasure mechanism
("the email on your SettleGrid account is usually sufficient") cannot be invoked by an anonymous payer; and
`ledgerEntries` is absent from the compliance data-export path entirely (`compliance.ts` does not reference it).
The notice is itself a DRAFT pending counsel review. **Therefore the V-N3 doc MUST NOT claim the exemption
covers anonymous payers — that would be a DC-16 false-compliance claim.** Instead the doc this chunk produces:
1. RECORDS the financial/AML retention basis as a *candidate* justification (not a settled exemption).
2. EXPLICITLY flags that the current privacy notice's exemption was scoped to account-holders and has a GAP
   for the anonymous on-chain payer's raw EVM address (a new data-subject category).
3. ROUTES the lawful-basis determination + any erasure/anonymization path to a dedicated **V-N3-erasure chunk**
   (where the `operation_id`-anonymization-vs-dedup-key tension is designed carefully), as an OPEN question.
4. Notes V-N1's cap bounds the attacker-inflatable PII surface (the bundling rationale), and that EXISTING
   over-cap rows' payer PII persists until that erasure chunk (the §5 prod-count gates it).
5. RE-RAISES to the founder before any retention/exemption language is PUBLISHED to users.

Documenting "retained; basis = candidate financial/AML; account-holder-only gap flagged; erasure routed to
V-N3-erasure" is DC-16-safe. Documenting "exempt" is the false-compliance trap. **No production CODE change
for V-N3** beyond this gap-documenting doc.

---

## 7. ⚠ THE #1 BUILD TRAP — test-fixture blast radius (DC-05)

Adding the cap will REJECT many existing test fixtures that use a far-future `validBefore`. This is the
single largest mechanical risk in the build. Method: after writing the cap, run the gate; it will surface
every broken test. Migrate each broken fixture to a within-cap window RELATIVE TO THAT TEST'S CLOCK.

> NOTE (audit): the per-file verdicts below were RESOLVED by reading every candidate file (not deferred to the
> gate). The gate is the defense-in-depth confirmation, not the discovery mechanism. Line numbers are
> approximate — locate by content.

**REAL-verifier files → MUST MIGRATE (exactly 4; migrate the SHARED default literal, not per-case):**
- `circle-nano/__tests__/verify.test.ts` — the shared `DEFAULT_AUTH.validBefore = '2000000000'` (~line 73)
  feeds EVERY `signedProof()`, with `PARAMS.now = 1000`. ⚠ The cap sits at the 6th check (after EXPIRED, before
  amount + crypto), so it is NOT just the accept cases that break: the reject cases that inherit the default and
  assert a code from a LATER check flip to `CIRCLE_NANO_VALIDBEFORE_TOO_FAR` — "rejects an under-payment"
  (expects `AMOUNT_MISMATCH`), "rejects a tampered signature" + "value tampered after signing" (expect
  `AUTH_INVALID`). **FIX: change the shared `DEFAULT_AUTH.validBefore` (line 73) to `'1300'`** (within
  `now+3600=4600`, `> now=1000`) — one edit fixes the accept block AND all three inheriting reject cases. KEEP
  the explicit `validBefore:'500'` expired case (~line 186). Network + wrong-recipient cases are checked BEFORE
  the cap (unaffected); the non-integer case throws at parse before the cap (unaffected) — confirm.
- `circle-nano/__tests__/verify.fuzz.test.ts` — ⚠ NOT merely a coverage nudge: line ~141 is a HARD
  `expect(...valid).toBe(true)` on `validSignedProof()` whose shared `validBefore='2000000000'` (~line 72) +
  `PARAMS.now=1000` → the cap makes it **RED**. **FIX: migrate `validSignedProof().validBefore` (line 72) to
  `'1300'`.** (The `pick(['2000000000',…])` randomized-envelope path at ~line 115 always asserts `valid:false`
  via sig non-recovery, so the cap does not gut it — a within-cap `pick` entry is optional polish, not the break.)
- `api/circle-nano/__tests__/e2e-smoke.test.ts` — REAL route + REAL verifier (header self-declares no mock).
  ⚠ the single shared `validBefore:'9999999999'` (~line 69, real `Date.now()` clock) breaks the accept case AND
  the over-auth REJECT cases (which expect `AMOUNT_MISMATCH` / 402, now flipping to `VALIDBEFORE_TOO_FAR`).
  **FIX: migrate the one literal (line 69) to `String(Math.floor(Date.now()/1000) + 300)`** (within-cap;
  arithmetic verified). Wrong-payee case is pre-cap (unaffected). Do NOT "fix per-case" — one literal edit is
  correct; per-case edits risk a falsely-green wrong-code assert.
- `lib/__tests__/circle-nano-402-discovery.test.ts` — real `verifyCircleNanoAuthorization`, `validBefore =
  2_000_000_000n`, `now:1000`, asserts `valid:true` (~lines 114/147/150). **FIX: migrate `2_000_000_000n` → `1300n`.**

**ADD the new x402 cap tests here (real verifier, currently within-cap — SAFE, but is the home for new cases):**
- `apps/web/src/lib/__tests__/x402.test.ts` (NOTE the path — there is NO `x402/__tests__/x402.test.ts`; the
  real-`verifyExactPayment` suite is under `lib/__tests__/`). Its default fixture is `String(now+600)`
  (~line 277, within-cap → unaffected). Add: boundary ACCEPT at `now+3600` / REJECT at `now+3601` →
  `AUTHORIZATION_VALIDBEFORE_TOO_FAR`; the strict-parse case (non-numeric `validBefore` rejected, not silently
  passed — the §4 NaN fix); and confirm the §4 `now→BigInt` change keeps `:416-428` green.

**Confirmed NOT affected — verifier mocked / verifier-not-in-path / SDK-not-capped (do NOT migrate; gate confirms):**
- `x402/__tests__/orchestrate.test.ts` — `vi.mock('../../circle-nano/verify')` (~line 45). Add the new
  `verifyFailureOutcome` map-entry assertion (`CIRCLE_NANO_VALIDBEFORE_TOO_FAR → X402_VALIDBEFORE_TOO_FAR`/402) here.
- `circle-nano/__tests__/settle.test.ts`, `x402/__tests__/parse.test.ts`, `circle-nano/__tests__/settle-engine.test.ts`,
  `transport-isolation.test.ts` — verifier is NOT in the settle/parse/engine path; `9999999999` flows only to the
  metadata writer / parser / on-chain submitter (never the cap).
- `api/circle-nano/__tests__/route.test.ts`, both `proxy/[slug]/__tests__/*-settlement.test.ts`,
  `api/x402/__tests__/x402-facilitator.test.ts` — the verifier / settlement layer is mocked.
- `apps/web/src/__tests__/smoke.test.ts` — export-shape assertion only (no verify call, no fixture).
- `packages/mcp/__tests__/circle-nano-adapter.test.ts` / `adapter-p2k2-hostile.test.ts` — SDK adapter (NOT
  capped); `validBefore:'2000000000'` stays valid in the adapter's best-effort expiry check.

**New test cases to ADD (the cap's own coverage — required, not optional):**
- circle-nano `verify.test.ts`: ACCEPT at exactly `validBefore = now + 3600` (boundary, inclusive — the cap is
  `> now+MAX`, so `== now+MAX` must PASS); REJECT at `now + 3601` with `CIRCLE_NANO_VALIDBEFORE_TOO_FAR`;
  REJECT the 2099 case.
- x402 `x402.test.ts`: same boundary pair returning `AUTHORIZATION_VALIDBEFORE_TOO_FAR`; PLUS a case proving
  the strict-parse fix (a non-numeric `validBefore` is rejected, not silently passed — the §4 NaN hole).
- x402 settle orchestrator (`orchestrate.test.ts`, mocked verify): assert the new `verifyFailureOutcome` map
  entry → `X402_VALIDBEFORE_TOO_FAR` / 402.
- A non-vacuity proof for the boundary tests (the standard cadence: show RED-on-revert for at least the core
  reject case so the new tests aren't vacuous).

---

## 8. Frozen / careful surfaces (do NOT perturb without authorization)

- The EIP-3009 domain / signature recovery logic (`USDC_EIP712_DOMAINS`, `TRANSFER_WITH_AUTHORIZATION_TYPES`,
  `checkCanonicalSignature`, the `recoverTypedDataAddress` gate). ONLY add the upper-bound check alongside the
  existing time-window checks.
- The credit path (V-N2 territory — NOT this chunk).
- The on-chain readers + `runExpiryPass` / the reconciler (V-N4-sealed). This chunk is verify-side only. The
  Q2 "verify-only" decision keeps us OUT of `runExpiryPass` — honor it.
- The `metadata.validBefore` writer + `refreshPendingValidBefore` (the (V) raise-only refresh). Audit-CONFIRMED:
  verify (`orchestrate.ts:343` / `circle-nano/settle.ts`) runs and returns-on-failure BEFORE `ensurePendingRow`
  + `refreshPendingValidBefore`, so an over-cap `validBefore` rejects at verify and never reaches the writer —
  **provided the §4 parse hole is plugged** (an unparseable value that bypassed the cap is the only way to reach
  the writer, where `BigInt(...).toString(10)` would then throw). The invariant holds IFF the cap is total (§4).
- The `X402_MAX_TIMEOUT_SECONDS = 300` advertised value — leave as-is (changing it is a separate protocol
  decision; the cap is independent of it).

---

## 9. Defect-class lenses to charge (`.audit/defect-ledger/INDEX.md`)

- **DC-09** (immortal/unconfirmable rows — the core problem).
- **DC-18** (alarm-fatigue / detector truthfulness — the `pending_overdue`/`noTxhashCount` inflation).
- **DC-16-adjacent** (V-N3 PII/retention; AND the DC-16 false-compliance-claim risk if the exemption doc
  over-asserts — §6).
- **DC-12** (the cap must be total: strict parse, the x402 NaN hole, the `validAfter ≤ validBefore` interplay — §4).
- **DC-07** (the new code must land at ALL 5 surfaces consistently; ONE `MAX_VALIDBEFORE_WINDOW_SECONDS` literal — §2/§3).
- **DC-05** (the test-fixture migration — §7; mocked-vs-real verifier divergence).
- **DC-15** (any doc/contract claim the cap or the V-N3 doc changes — e.g. public x402 docs, the register entry).

---

## 10. Gate + cadence

- **Gate (from repo root):** `pnpm -w turbo typecheck lint test` (or per-package: `apps/web` → `vitest run`,
  `next lint`, `tsc --noEmit`; `packages/mcp` → its build/test). The build must run the FULL gate green
  (typecheck + lint + test across both `apps/web` and `packages/mcp`, since `CircleNanoErrorCode` is in the SDK
  package). Record the pre-build floor (current test counts) and the post-build counts in the cadence-status
  report.
- **Cadence:** scope-confirm (this file) → write the shared constant + cap at both verifiers + the 5-surface
  code wiring → fix §4 parse → migrate §7 test fixtures + ADD the new cap tests → V-N3 doc (§6) → gate GREEN
  → ② seal-gating review (fresh session) → ③ post-seal deep audit → founder-close (local commit; never push).
- Effort: **xhigh** for the build; escalate to `/effort max` only for a genuinely hard stretch (e.g. the §4
  parse-unification regression proof, if it gets thorny).

---

## 11. Pre-build plan audit — disposition (2026-06-14)

A HIGH-STAKES pre-build plan audit ran as a 5-lens independent Agent-tool fan-out (NOT a workflow — the
operator did not say `ultracode`), all reviewers inheriting `claude-opus-4-8` and reasoning at maximum depth,
coverage mode, with adversarial verification of every sustained mechanical claim (settled with live `node`
execution + file reads, NOT memory). NO finding was refuted on verification — all held. There were **0 BLOCKERs**.
Lenses: (1) cap-value/settlement-timing, (2) multi-surface/DC-07 completeness, (3) DC-12 parse/robustness,
(4) test-blast-radius/DC-05, (5) retroactivity + V-N3 + DC-16/DC-18.

Every finding is folded into §§2-8 above. Disposition table:

| # | Lens | Sev | Finding (one line) | Disposition |
|---|------|-----|--------------------|-------------|
| F1 | 3 | HIGH | BigInt unification makes `now-validBefore` / `validAfter-now` arithmetic throw (`bigint-number`), swallowed → wrong code + breaks `x402.test.ts:416-428` | FOLDED §4 — explicit build sub-step: set `now = BigInt(...)`; arithmetic stays bigint-bigint, same digit output, tests pass (VERIFY) |
| F2 | 4 | HIGH | `verify.test.ts` migrating "acceptance only" leaves 3 inheriting REJECT cases flipping to `VALIDBEFORE_TOO_FAR` (cap is the 6th check) | FOLDED §7 — migrate the SHARED `DEFAULT_AUTH.validBefore` (line 73)→`'1300'`; one edit fixes accept + the 3 rejects |
| F3 | 4 | HIGH | fuzz `:141` is a HARD accept assertion that BREAKS (not "stays green") | FOLDED §7 — migrate `validSignedProof().validBefore` (line 72)→`'1300'` |
| F4 | 4 | HIGH | e2e-smoke over-auth REJECT cases ALSO flip code, not just accept | FOLDED §7 — migrate the single literal (line 69)→`String(floor(now)+300)` |
| F5 | 5 | HIGH | The financial-retention exemption does NOT cover anonymous payers (privacy notice scoped to Developers/Customers; `ledgerEntries` absent from compliance export) → DC-16 false-claim risk | FOLDED §6 — flipped to DEFAULT-STOP: document the GAP, route lawful-basis+erasure to a V-N3-erasure chunk, re-raise before publishing |
| F6 | 3 | MED | Enumerate parseInt→BigInt divergences (empty/ws→0, hex accepted; R-V7-hex DEPENDS on hex); all fail-closed/more-correct | FOLDED §4 — divergence list + "do not fix back" posture |
| F7 | 3 | MED | `validAfter ≤ validBefore` degenerate window → a `<=` guard false-rejects the legit `vb==va==now` instant; `<` guard is dead code | FOLDED §4 — resolved to explicit DEFER (add no guard) |
| F8 | 2 | MED | Permit2 `deadline` is the same uncapped pattern but verify-only (no pending row) — verdict-inconsistency residual | FOLDED §3 out-of-scope — flagged as verify-consistency follow-up, no scope expansion |
| F9 | 2 | MED | The 2 standalone settle routes collapse the code into generic `PAYMENT_VERIFICATION_FAILED` (pre-existing, not a regression) | FOLDED §3 — passthrough accounting corrected |
| F10 | 4 | MED | §7 "MUST determine at build" list over-broad — all 6 resolved NOW (none migrate) | FOLDED §7 — replaced deferral with resolved verdicts; gate confirms |
| F11 | 4 | MED | 2 verifier-touching files absent from §7 (`x402-facilitator.test.ts` mocked, `smoke.test.ts` no-fixture) — both safe | FOLDED §7 — added to confirmed-safe list |
| F12 | 5 | MED | Register "root fix of clusters" over-claims — existing rows' immortality AND payer PII both persist | FOLDED §5 — re-warn-the-founder note added |
| F13 | 5 | MED | V-N3 PII inventory incomplete — misses the facilitator `/v1/verify` payer echo; affirm no log/Sentry leak | FOLDED §6 — third (transient) surface + clean-log note added |
| F14 | 1 | LOW | Clock-skew DIRECTION should be explicit (cap compares buyer `validBefore` vs SERVER `nowSec`) | FOLDED §2 |
| F15 | 1/5 | LOW | Cap must stay materially below the 6 h `overdueAfterMs` alarm or it re-inflates the signal | FOLDED §2 — "do not loosen to 6 h" |
| F16 | 4/3 | LOW | `x402.test.ts` real-verifier suite is under `apps/web/src/lib/__tests__/`, not `x402/__tests__/` | FOLDED §7 — path corrected |
| F17 | 2 | LOW | `CircleNanoErrorCode` is a published SDK export → additive non-breaking API change | FOLDED §3/§9 — DC-15 note |
| F18 | 2/3 | LOW/INFO | §8 refresh-gating invariant holds IFF the cap is total; constant home introduces no import cycle; `X402SettlementOutcome.code` is a free string | FOLDED §8/§2 — confirmed |
| — | 1 | INFO | Reconciler is read-only (no re-broadcast); every settle path re-verifies in-request → no path needs `validBefore` > a single attempt; 3600s rejects nothing legit | Confirms §2 — no change |

**VERDICTS:** Lens 1 — 3600s SOUND (no magnitude change). Lens 2 — buildable, 3 doc-accuracy folds, no missed
cap-logic surface. Lens 3 — directionally sound; BigInt unification IS the right call, amended with the F1
`now→BigInt` sub-step + F7 DEFER. Lens 4 — §7 scope was incomplete/under-specified; corrected (migrate shared
literals; resolved verdicts; +2 files). Lens 5 — §5 sound; §6 was NOT sound, flipped to default-stop (F5).

## 12. Build-ready checklist (post-fold)

1. Define `MAX_VALIDBEFORE_WINDOW_SECONDS = 3600` (a `number`) in `x402/types.ts`; import at both verifiers.
2. circle-nano/verify.ts: cap after the EXPIRED check; new `CIRCLE_NANO_VALIDBEFORE_TOO_FAR` (+ SDK union).
3. x402/verify.ts: unify parse on BigInt incl. `now = BigInt(...)` (F1); cap before the on-chain reads; new
   `AUTHORIZATION_VALIDBEFORE_TOO_FAR` (+ `X402VerifyErrorCode` union).
4. x402 orchestrate.ts: add the `verifyFailureOutcome` map entry → `X402_VALIDBEFORE_TOO_FAR`/402.
5. Migrate the 4 shared test literals (F2/F3/F4 + discovery); ADD the boundary + strict-parse cap tests; add
   the orchestrate map-entry assertion; prove non-vacuity (RED-on-revert) for the core reject.
6. V-N3: write the GAP-documenting doc (§6 default-stop) — no production code.
7. Full gate green across `apps/web` + `packages/mcp`; record floor + post counts; cadence-status report.
