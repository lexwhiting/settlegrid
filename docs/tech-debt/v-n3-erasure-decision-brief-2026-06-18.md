# V-N3-erasure — FOUNDER + COUNSEL DECISION BRIEF (2026-06-18)

> **This is a decision package, not a build.** No production code ships from this brief. It exists
> so the founder (with counsel) can make the lawful-basis call and pick a technical shape; only then
> is the V-N3-erasure chunk scoped and built. Builds on the prior analysis
> `v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md` (the surface inventory) — read that for the
> raw census; this brief adds the **dedup-preserving technical options** and the **decisions required**.

## 0. One-paragraph summary
Every settlement row in `ledger_entries` persists the **anonymous on-chain payer's raw EVM address**
in two columns: `operation_id` (the load-bearing replay/idempotency key) and `metadata.payer`. There
is **zero `delete`/scrub of these tree-wide.** The compliance surface is now **honest** about this
(the V-N3 SLICEs already corrected the earlier false "PII is scrubbed" claim — see §2), so this is **no
longer an active-false-compliance emergency** — it is an open **lawful-basis + erasure-design** question.
The hard part is that the payer address sits inside `operation_id`, the money rails' replay-safety key,
so it cannot be naively nulled. The recommended shape (Option B) anonymizes the payer **only on terminal
rows past a retention window**, never touching the live dedup path. **Two things gate the build: a
counsel lawful-basis determination, and the founder picking the retention period + anonymize-vs-delete.**

## 1. Exactly where the payer PII lives (verified in code, 2026-06-18)
| Surface | Where | Persisted? | Role |
|---|---|---|---|
| `ledger_entries.operation_id` | `x402OperationId` (`x402/orchestrate.ts:117`) + `circleNanoOperationId` (`circle-nano/settle.ts:90`), both = `` `${rail}:${network}:${from.toLowerCase()}:${nonce.toLowerCase()}` `` | **YES, indexed** (`ledger_entries_operation_id_idx`) | **Load-bearing dedup / replay key** |
| `ledger_entries.metadata.payer` | `= authorization.from` (x402 `orchestrate.ts:159`, circle-nano `settle.ts:121`) | **YES** (jsonb) | Forensic / audit field; **not a key** |
| `/v1/verify` response `payer` | `x402/verify.ts` echoes `authorization.from` on every branch | **NO** (transient response, x402-spec read shape) | Inventory only; not stored |
| Logs / Sentry | — | **CLEAN** (grep = 0 payer-address args to any log/capture sink) | n/a |

So an erasure design targets exactly **two stored columns**: `operation_id` and `metadata.payer`.

## 2. Honesty status — the earlier "false claim" is already CORRECTED (not an emergency)
The 2026-06-14 gap doc flagged `processDataDeletion` as actively telling a developer their financial-record
PII was "scrubbed" while the payer address persisted — a DC-16 false-compliance surface. **The V-N3
compliance-honesty SLICEs (2026-06-16…18) fixed this.** `compliance.ts:373-391` now reads (verbatim): the
financial records "are RETAINED for 7-year IRS / Stripe bookkeeping and are NOT rewritten here," followed by
an explicit **"KNOWN GAP — `ledger_entries` additionally persists the anonymous on-chain PAYER's raw EVM
address … This deletion does NOT touch those columns, so that address is retained UN-scrubbed,"** and the
result surfaces a `retainedUnscrubbed` field. **The disclosure is honest today.** → There is **no urgent,
un-gated correction left to make**; the remaining work is the actual erasure, which is genuinely gated on the
decisions below. (This removes the time pressure: we are not currently lying to users.)

## 3. The dedup constraint (why `operation_id` can't just be nulled)
`operation_id` is the **deterministic replay/idempotency key**: the row's primary `id` is derived from it,
and `markSettlementSettled` / `markSettlementFailed` / `markSettlementBroadcast` / `findSettlementRow`
(`ledger.ts:557-818`), the reconciler (`reconcile.ts:416,963`), and the proxy (`route.ts:1755`) all locate the
row via `eq(ledgerEntries.operationId, …)`, with `ON CONFLICT DO NOTHING` for idempotency. The **payer
segment supplies per-`(payer, nonce)` uniqueness** — the EIP-3009 nonce is payer-chosen and can collide
across distinct payers, so dropping the payer outright risks key collisions. **Therefore any rewrite of the
payer segment must preserve uniqueness + determinism, and must not change the key of a row that still has a
live `eq(operationId)` lookup in flight.** The replay-safety need ends once a row is **terminal (settled/failed)
AND its on-chain nonce is consumed** — a replay then fails on-chain regardless of the DB key.

## 4. The lawful-basis question — FOR COUNSEL (facts, not a legal conclusion)
*I am not counsel; this frames the question and the facts. The determination is counsel's.*
- **Data subject:** an anonymous on-chain payer — has **no SettleGrid account and no email**, so the existing
  account-scoped erasure mechanism (privacy notice: "the email on your account is usually sufficient")
  **cannot be invoked by them.** The privacy notice (`docs/legal/privacy-notice-draft.md`, **DRAFT, pre-counsel**)
  scopes data subjects to **Developers + Customers only** — it has **no anonymous-payer category.**
- **Candidate retention basis (NOT yet settled for this subject):** settlement records are the canonical money
  trail; AML / bookkeeping / IRS 7-year retention is a recognized lawful basis for **financial records**. Whether
  that basis extends to the **third-party payer's raw EVM address** (vs. the developer's own financial data) is
  the open question. The raw address is arguably **not required** for the developer's books — a pseudonym/anonymized
  token may satisfy the financial-record purpose while removing the third party's PII.
- **The trap (do NOT pre-empt counsel):** asserting "exempt under financial retention" in any user-facing language
  before counsel confirms it would itself be a DC-16 false-compliance claim. This brief asserts neither "exempt"
  nor "must erase."

## 5. Decisions required (the gate)
| # | Decision | Owner | Why it blocks the build |
|---|---|---|---|
| **D1** | Is the raw payer EVM address subject to erasure, or retained under a financial/AML basis — and for **how long**? | **Counsel** | Sets whether this is on-demand erasure vs. a time-bounded retention purge, and the window. |
| **D2** | Does **anonymization** (irreversible hash / tombstone, money trail preserved) satisfy the obligation, or is **row deletion** required? | **Counsel + Founder** | Picks the technical shape (Option B vs C below). |
| **D3** | Accept that the payer is **accountless** → erasure is **automatic/time-bounded**, not request-driven? | **Founder** | There is no subject to file a request; the mechanism must be a scheduled job. |
| **D4** | Privacy-notice update: add an **anonymous-payer subject category** + the chosen basis + an account-less mechanism. Publish **only after counsel sign-off**. | **Counsel + Founder** | DC-16 — publishing language ahead of the basis is a false claim. |

## 6. Technical design options (preserve the dedup key)
**Option A — Pseudonymize at WRITE, going forward.** Change both builders to emit
`{rail}:{network}:{HMAC(secret, payer)}:{nonce}`. Preserves dedup uniqueness/determinism for new rows; new
rows never store the raw address. **But:** ongoing dedup needs the secret RETAINED → this is **pseudonymization,
not erasure** (re-identifiable by the secret-holder; GDPR still treats it as personal data). And it **mutates the
live load-bearing key** → existing-row migration is risky (re-derives every row `id`, must not break in-flight
`eq(operationId)` lookups). *Value:* shrinks the raw-address footprint going forward. *Cost/risk:* touches the
money-rail key; high-stakes migration; doesn't by itself erase existing rows.

**Option B — Time-bounded ANONYMIZATION of terminal rows (RECOMMENDED).** A scheduled job (mirroring the
existing `data-retention` cron, which already purges 6 other tables and is the architectural precedent) targets
**only rows that are `settlement_status` terminal AND older than the retention window** (D1). For each: rewrite the
`operation_id` payer segment to an **irreversible token** (e.g. `{rail}:{network}:{sha256(payer\|nonce)}:{nonce}`,
or a per-row random tombstone since post-window dedup is no longer needed), and **null `metadata.payer`**. *Why it's
the right shape:* (a) **never touches the live dedup path** — only terminal+aged rows, whose replay window is closed;
(b) **true anonymization** — no retained key-mapping (unlike A's retained secret); (c) **preserves the financial
money trail** (amounts, rail, status, dates) while removing the third-party PII; (d) maps cleanly onto the likely
counsel answer ("keep the money trail for the AML period, then anonymize the third party"). *Cost:* one new
retention job + a careful one-time backfill of existing terminal rows; must re-derive the row `id` consistently
(or leave `id` and only rewrite the column + null metadata, if `id` is not itself PII-derived — to confirm at build).

**Option C — Row DELETION after the window.** `delete(ledgerEntries)` on terminal aged rows. Simplest, but
**destroys the financial record** you likely must retain for IRS/AML. Almost certainly wrong for the developer's
books; only viable if counsel rules these specific anonymous-payer rows carry no retention duty. Listed for
completeness; expected to be rejected.

**Recommendation:** **Option B**, with the retention window and the anonymize-vs-delete confirmation set by D1/D2.
Treat Option A (write-time pseudonymization) as an **optional, separately-audited follow-up** if counsel wants to
minimize the live-window exposure — it is higher-risk because it mutates the load-bearing key, so it should not be
bundled into the first erasure chunk.

## 7. What this brief does NOT do
- Ships **no code** and publishes **no user-facing language.**
- Makes **no legal determination** — D1/D2/D4 are counsel's.
- Does not touch the `operation_id` key or `compliance.ts` (the honesty disclosure is already correct, §2).

## 8. Once decided → the V-N3-erasure build chunk
On D1–D4, the build chunk is: (1) the Option-B retention/anonymization job + a one-time terminal-row backfill;
(2) wire `ledger_entries` payer-anonymization into the retention surface and update `compliance.ts`'s
`retainedUnscrubbed` disclosure to reflect the new "anonymized after N years" reality; (3) the counsel-approved
privacy-notice update. Tier: **HIGH-STAKES** (touches the money-rail dedup key + PII + a published claim). The
`operation_id` mutation is the load-bearing decision most likely to be silently wrong — it gets the heavy audit.
