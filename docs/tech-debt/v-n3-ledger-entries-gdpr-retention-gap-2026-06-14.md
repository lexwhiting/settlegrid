# V-N3 — `ledger_entries` payer-PII retention GAP (documented, NOT exempted) — 2026-06-14

> Produced by the V-N1 build chunk (bundled per the founder decision). **This is a
> gap-documenting record, NOT a compliance assertion.** It deliberately does NOT claim the
> existing financial-retention exemption covers the anonymous on-chain payer — doing so would be
> a DC-16 false-compliance claim (the privacy notice's exemption was scoped to account-holders).
> **No production code ships for V-N3.** The lawful-basis determination + any erasure/anonymization
> path are routed to a dedicated **V-N3-erasure** chunk and must be re-raised to the founder before
> any user-facing retention/exemption language is published.

---

## 1. The surfaces that persist the anonymous payer's EVM address

On **every** settlement row (`ledger_entries`), the payer's raw EOA address is written into TWO
indexed/persisted places:

1. **`operation_id`** = `{rail}:{network}:{payer_addr}:{nonce}`
   - circle-nano: `apps/web/src/lib/settlement/circle-nano/settle.ts` (operation-id builder)
   - x402: `apps/web/src/lib/settlement/x402/orchestrate.ts:104-106` (`x402OperationId`)
   - This is the **load-bearing dedup / idempotency key** — used in `eq(ledgerEntries.operationId, …)`
     lookups and the deterministic-id `ON CONFLICT` writer. Anonymizing it is entangled with the
     money rails' replay-safety, which is **why erasure is not rushed into this chunk.**
2. **`metadata.payer`** = `authorization.from`
   - circle-nano: `circle-nano/settle.ts` (metadata writer)
   - x402: `x402/orchestrate.ts:157` (`payer: proof.authorization.from`)

**Third surface — TRANSIENT (response echo, not persistence):** the public facilitator
`/v1/verify` RESPONSE echoes the payer address on every branch (`x402/verify.ts` returns
`payer: authorization.from` on the valid + each invalid branch). This is the x402-spec read-only
response shape, not a stored record — but the erasure design's inventory must name it.

**Affirmatively confirmed CLEAN:** no `logger`/Sentry call in the settlement tree logs the payer
address (grep = 0 hits for a payer-address argument to a log/capture sink). So the **persistence**
surfaces an erasure design must target are exactly **two**: `operation_id` and `metadata.payer`.

## 2. Retention reality today

- The `data-retention` cron purges **6** tables (`invocations`, `webhook_deliveries`, `audit_logs`,
  `tool_health_checks`, `conversion_events`, `compliance_exports`). It does **NOT** touch
  `ledger_entries` — there is **zero `delete(ledgerEntries)` tree-wide**.
- `ledgerEntries` is **absent** from the compliance data-export path (`apps/web/src/lib/settlement/compliance.ts`
  does not reference it), so a subject-access / erasure request routed through the compliance module
  would not see these rows at all.

## 3. The lawful-basis GAP (why we MUST NOT write "exempt")

The pre-build audit read `docs/legal/privacy-notice-draft.md` + `compliance.ts` and found the existing
financial-retention exemption does **NOT** cover anonymous on-chain payers:

- The privacy notice **§2 scopes data subjects to "Developers" and "Customers" only**; its §3.1 inventory
  was derived from the `developers` table + related tables. There is **no anonymous-payer concept.**
- The account-less erasure mechanism it describes ("the email on your SettleGrid account is usually
  sufficient") **cannot be invoked by an anonymous payer** — they have no account and no email.
- The notice is itself a **DRAFT pending counsel review.**

Therefore the **financial / AML retention basis is recorded here as a CANDIDATE justification only** —
plausible (settlement records are the canonical money trail; AML/bookkeeping retention obligations are a
recognized lawful basis for financial records) but **NOT a settled exemption** for the raw EVM address of a
data-subject category (the anonymous payer) the notice never contemplated. **Writing "exempt" would be a
DC-16 false-compliance claim. We do not.**

## 4. What V-N1 changed (the bundling rationale) — and what it did NOT

- **V-N1 bounds the *attacker-inflatable* PII surface.** Before the cap, a buyer could mint unbounded
  immortal `pending` rows (`validBefore` = year 2099), each permanently indexing payer PII. The cap
  (`validBefore > now + 3600 → reject`, both verifiers) means **NEW** rows can no longer be made
  immortal — the class can't recur.
- **V-N1 does NOT erase or anonymize anything.** Every settlement row (legitimate or otherwise) still
  persists the payer address in `operation_id` + `metadata.payer`. **EXISTING over-cap rows' payer PII
  persists** until the erasure chunk ships; their immortality in `pending_overdue`/`noTxhashCount` also
  persists (the V-N1 §5 prod-count gates BOTH that cleanup and this erasure).

## 5. Routed to the V-N3-erasure chunk (OPEN questions for the founder + counsel)

A dedicated **V-N3-erasure** chunk must design (and re-raise to the founder BEFORE publishing any
user-facing language):

1. **Lawful basis determination** for retaining an anonymous payer's raw EVM address — confirm/deny the
   candidate financial/AML basis with counsel; decide retention period.
2. **The `operation_id`-anonymization-vs-dedup-key tension.** `operation_id` is the replay/idempotency
   key; you cannot naively hash/null the payer segment without preserving the dedup guarantee (and any
   migration must not collide or un-dedup live rows). This is the hard part and must be designed carefully.
3. **`metadata.payer` anonymization / tombstoning** path + whether the `/v1/verify` transient echo needs
   to change.
4. **Add `ledger_entries` to the compliance/erasure surface** so an erasure request can actually reach it
   (it is invisible to `compliance.ts` today).
5. **Privacy-notice update** introducing the anonymous-payer data-subject category + the chosen basis +
   an account-less erasure mechanism — **published only after founder + counsel sign-off.**

## 6. Defect-class lenses

- **DC-16-adjacent** — PII/retention; AND the DC-16 false-compliance-claim risk this doc deliberately
  avoids (record candidate-basis + gap, never "exempt").
- **DC-09 / DC-18** — the existing over-cap rows' immortality + alarm inflation persist until the §5
  prod-count-gated cleanup (cross-referenced from the V-N1 handoff §5).

## 7. Status

- **V-N1 cap:** SHIPPED this chunk (verify-time, both rails, new buyer-facing 402). Local-build only.
- **V-N3 erasure code:** NOT shipped (by design). Routed to V-N3-erasure.
- **Re-raise gate:** founder must be consulted before any retention/exemption language is published, and
  before the V-N3-erasure design touches the `operation_id` dedup key.
