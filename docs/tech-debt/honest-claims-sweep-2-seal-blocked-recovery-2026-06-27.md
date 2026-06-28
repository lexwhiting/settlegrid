# ② SEAL-GATING REVIEW — 🔴 BLOCKED → BUILD RECOVERY — honest-claims-sweep — 2026-06-27

**Outcome:** ② **BLOCKED** (could not seal). Routed to the recovery loop → back to build, then re-②.
**Gate was GREEN** (independently re-run from scratch, matches the build's digest): settlegrid `tsc 0` / `lint 0` /
`vitest 209 files·4823 passed` / honest-framing `63 passed`; agents `866 passed` / `tsc 0`. **All frozen surfaces
intact.** The build is ~90% correct — **this is a focused DELTA on the existing working tree, NOT a redo.**

**Review:** 5 decorrelated fresh-context Agent-tool lenses (truth/over-correction · spec-conformance ·
completeness/SEAM · literal-execution/guard-teeth · scope-boundary/frozen+commit-hygiene), all
`claude-opus-4-8[1m] @ high` (policy floor; no Path-1 effort-bearing defs exist, Agent tool exposes no effort
param — `xhigh`/`max` target unmet but `high` surfaced concrete, live-reproduced HIGH findings, and the integrator
independently verified each). Integrator live-verified every load-bearing finding before triage.

---

## 1. WHAT THE BUILD GOT RIGHT — PRESERVE, do NOT redo
- Every **named** G1-1…G1-5 surface is conformant (Lens 2: stats-bar/smart-proxy/blog "15"→"9"/"multi"; the
  1,017→"servers" noun reconciliation; 97 where forkable-template is the claim; ~15 latency surfaces reworded;
  docs Bucket-A crypto demotions + USDT fully removed; agents 5-file demotion with x402 kept in the 9-list).
- **11/12 regression guards have byte-verified teeth** (Lens 4), no live false-positives.
- **Frozen intact** (Lens 5): "9 brokered" count+verb; `mcp.json protocols[]` len 11; the uncommitted slugify
  change; all money/auth/settlement code + dark-crypto config; stats-bar `:6/:7` revenue-share + free-tier stats.
- **"22 categories" is TRUE** (catalog = 1017 entries / 22 distinct categories) — keeping 22 (not the handoff's
  "→6" default) was the correct DC-16a call.
- The `status:'Production'→'Testnet'` x402 edit on `[slug]/page.tsx:112` is display-only (nothing branches on
  `status`); the agents `config.ts` edit is comment-only. No tier escalation.

---

## 2. BLOCKING FIXES — the seal failed on these

### B1 — x402 INDEX-page self-contradiction  [HIGH·HIGH] — *in original G1-4 scope; build missed the badge layer*
`apps/web/src/app/learn/protocols/page.tsx:67` `status: 'Production'` → **`'Testnet'`** (mirror the demotion the
build already landed on the `[slug]` detail page). The `:68` oneLiner "On-chain USDC payments via HTTP 402 for
trustless machine commerce" is protocol **education** (what x402 *is*) → **KEEP**; the **badge** is the self-claim.
**WHY:** the same diff demoted x402 to `'Testnet'` / "native x402 support is in development and not currently
available" on `[slug]/page.tsx:112,118`; code agrees (`api/proxy/[slug]/route.ts:1914` "Until then x402 is NOT
accepted"). Shipping `'Production'` on the index page is a public self-contradiction the chunk created. The
build's grep re-scan missed it because the claim is an **enum value** (`status:'Production'`), not prose → **DC-16d**.

### B2 — L402 false-while-dark self-claim  [HIGH·HIGH] — *FOUNDER-AUTHORIZED scope expansion beyond handoff §1 Bucket-C*
**FOUNDER DECISION (2026-06-27, operator):** demote L402 **and harmonize the whole `learn/protocols` status-badge
layer in-chunk** — this *overrides* the original handoff's "`:390/:392` do-not-touch (Bucket-C education)". Reason:
those lines are present-tense **self-claims**, not education; leaving x402 demoted while L402 stays 'Ready' is a
worse inconsistency than before; canonical framing already says L402 is **detection-adapter-only**.
**Grounding (verified):** `isL402Enabled()` (`lib/env.ts:298` = `L402_ENABLED==='true' || !!LND_REST_URL`) is
config-dark in prod → mock invoices only; `api/proxy/[slug]/route.ts:518` only dispatches L402 when enabled;
`public/llms.txt:261` + `components/marketing/protocols.tsx:27` class L402 as "detection-adapter-only (NOT
brokered)"; the chunk's own homepage edit (`protocols.tsx:60`) already says "emerging Bitcoin Lightning… rails".
**Apply:**
- `apps/web/src/app/learn/protocols/[slug]/page.tsx:388` `status: 'Ready'` → demote (recommend `'Testnet'`, or a
  new `'Detection-only'`/`'Pending'` enum member — harmonize with how x402/Circle read).
- `:390` "SettleGrid is the **first** multi-protocol billing platform with **deep L402 support**, allowing any AI
  tool to **accept Bitcoin** alongside fiat and stablecoin payments" → demote the self-claim; keep generic L402
  education. Strip "first… deep L402 support" + "accept Bitcoin".
- `:394` "SettleGrid **has a deep L402 integration**… **Every tool on the platform can accept Lightning payments**
  via the Smart Proxy… real Lightning invoices are generated… otherwise mock invoices…" → demote to "in
  development / detection-adapter only; not currently available" (mirror x402/Circle wording).
- `apps/web/src/app/learn/protocols/page.tsx` (index) L402 entry `status:'Ready'` → demote to match.
- `apps/web/public/llms-full.txt:299` "Native Bitcoin Lightning micropayments…" → add the "in development /
  detection-adapter only" qualifier (matches the already-demoted Circle entry at `:293` in the same file).
- KYAPay (also "detection-adapter-only", badged 'Ready'): its prose is detection-scoped + honest ("verification is
  entirely local") → **leave the prose**; for badge consistency with the demoted L402, the build decides whether
  KYAPay 'Ready' is acceptable (it asserts only that detection works) or should match L402 — note the call.

### B3 — MPP status harmonization  [MED·HIGH] — *part of the founder-authorized status-badge harmonization*
`learn/protocols/page.tsx:57` + `[slug]/page.tsx:62` badge MPP `status:'Production'`, with `[slug]` prose
":64/:68" "deep, native MPP integration — **every SettleGrid tool automatically accepts** Stripe SPTs… with **zero
configuration**". But 6 surfaces canonically frame MPP as **"pending GA"** (`docs:54`, `faq:48`,
`how-mcp-billing:176`, `tools/[slug]:282`, `api/chat:33`, `README:123`) and the rail is gated on `STRIPE_MPP_SECRET`
(`route.ts:322`). **MPP is FIAT (Stripe), distinct from the crypto rails — VERIFY its true status first:** if
MPP/SPT is genuinely pending-GA, demote the badge ('Production'→'Ready'/'Pending') and soften "every tool
automatically accepts SPTs / zero config"; if MPP is actually live, document why and align the 6 "pending GA"
surfaces instead. Do NOT leave the 'Production'-vs-"pending GA" split.

---

## 3. BORDERLINE TRUTH CALLS — resolve in the build pass (defaults given; §9-style)

### T1 — "sub-millisecond Redis balance check"  [MED·MED] — *the handoff's OWN prescribed G1-3 replacement is itself unbacked*
On ~18 surfaces (README, llms.txt, llms-full.txt, features.tsx, smart-proxy.tsx, glossary, how-mcp-billing,
faq, docs, use-cases, `[slug]:39`). `lib/redis.ts` uses `@upstash/redis` (HTTP/REST client) → from a serverless
function the **balance check is a network round-trip** (single-digit-to-tens of ms), not sub-millisecond (the Redis
*operation* is sub-ms, but the round-trip dominates). The chunk removed an unbacked "<50ms" and introduced a
*smaller* unbacked number on training-data surfaces. **DEFAULT:** drop the magnitude → "a single Redis balance
check on the hot path; metering batched asynchronously" (keep the architectural claim, drop the number).
**FOUNDER OVERRIDE:** keep "sub-millisecond" only if a real in-region Upstash latency benchmark is cited.

### T2 — `docs/page.tsx:239` "supports USD, EUR, GBP, JPY, and USDC"  [MED·MED] — *handoff named it Bucket-A; build left it*
It's the multi-currency *billing* FAQ (exchange rates fetched + cached; amounts stored in smallest unit) →
**denomination** reading is defensible (USDC as a unit of account ≠ on-chain crypto *settlement*). **DEFAULT:** keep
but add a one-clause clarifier ("USDC as a settlement-denomination / unit of account"), OR document why denomination
is honest here while `:75` (on-chain crypto settlement) was demoted. Do not leave it undocumented (it's an
explicitly-named Bucket-A surface).

---

## 4. REGRESSION-TEST ADDITIONS (G1-5 — the gate currently has NO protocol-status-badge guard; that gap is why B1/B2 shipped)
Add file-scoped, **value-literal** guards (per the established pattern — NEVER a bare `/Production/`, which
legitimately appears for MCP/REST):
- New `PROTOCOLS_INDEX = repoFile('apps/web/src/app/learn/protocols/page.tsx')`; reuse `PROTOCOL_SLUG_TSX`.
- Assert the demoted self-claim sentences are ABSENT: e.g. `not.toMatch(/deep L402 (support|integration)/i)`,
  `not.toMatch(/every tool on the platform can accept Lightning/i)`, `not.toMatch(/accept Bitcoin alongside fiat/i)`.
- Pin the x402 index badge ≠ 'Production' WITHOUT a bare-`/Production/` false-trip — scope to the x402 entry (e.g.
  assert the demoted/added literal is present, or that "On-chain USDC payments… **Production**" proximity is gone).
- **Prove-it-fails-first:** each new badge/self-claim guard MUST be shown **RED against the current (pre-fix)
  working tree** and **GREEN after** — capture both in the new seal record.
- Lower-priority robustness (Lens 4 #5/#9, Lens 2 #7 — optional, note if deferred): `TEMPLATE_COUNT_CONFLATION`
  pins a fixed adjective-stack so synonym/`+`/reorder phrasings of "1,017 … templates" evade — broaden or document;
  add `(dashboard)/dashboard/tools/page.tsx:646` to the conflation file-list (currently unpinned); word-bound
  `/USDT/` if USDT could legitimately re-enter docs.

---

## 5. ROUTE-TO-FOLLOWUP (out of this chunk — add to the launch-gate queue / a data task; do NOT fix here)
- **F-data — ≥63 dead fork links:** `server-catalog.json` = **1017** entries but only **954** committed
  `open-source-servers/` dirs; "fork any on GitHub" (`servers/page:13/101`, `faq:56`) overstates by ≥63.
  PRE-EXISTING catalog drift (not a claims-wording defect this chunk created). Reconcile the catalog to the
  committed set, or soften "fork any"→"fork"/"browse". *(Lens 1 #3.)*
- **F4 — "1,444+ tools indexed"** (`agents/beacon/prompts.ts:18`): stale, matches no source (catalog 1017 /
  method-sum 2,490 / registry 97). Founder reconciliation. *(Lens 1 #5.)*
- **F-billing nit:** `faq:56` "add your API key" vs `servers`/`tools` "add SettleGrid billing" — inconsistent
  workflow verb for the same 1,017 (conservative, not false). Optional tighten. *(Lens 1 #6.)*

---

## 6. COMMIT HYGIENE — apply at SEAL time (Lens 5)
This chunk's commit includes ONLY the claims + regression-test files (settlegrid + settlegrid-agents are SEPARATE
commits in SEPARATE repos — no shared gate). **MUST EXCLUDE:**
- `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` — unrelated DB-credential incident status-close;
  give it its OWN commit.
- the **slugify hunk** inside `(dashboard)/dashboard/tools/page.tsx` (FROZEN §7) — **patch-stage only the `:646`
  line** via `git add -p`.
- untracked cross-chunk paths: `.claude/`, `docs/tech-debt/launch-gate-queue.md`,
  `docs/tech-debt/v-n3-mfa-unenroll-hardening-handoff-2026-06-27.md`, `scripts/mfa-delete-smoke.sh`.
- **NEVER** `git add -A` / `git commit -a`.

---

## 7. GATE TO RE-PASS, then re-②
- settlegrid (`apps/web`): `npx tsc --noEmit` → 0; `npm run lint` → 0 err; `npx vitest run` → all pass incl. the
  EXTENDED honest-framing test (new badge/self-claim guards proven RED pre-fix → GREEN post-fix).
- settlegrid-agents: `npx vitest run` → green; `npx tsc --noEmit` → 0.
- Then **re-enter ②** (high-stakes — ② is the seal gate; ③ post-seal deep audit follows on a clean seal).

---

## 8. DEFECT-CLASS LEDGER — new recurrences (fold into handoff §8)
- **DC-16d (NEW — non-prose claim layer / enum-status evasion):** a grep-based claim re-scan that matches PROSE
  misses claims encoded as ENUM/data values (`status:'Production'`, `status:'Ready'`). A status badge IS a
  self-claim. Cue: when sweeping a claim family, enumerate its STRUCTURED representations (status enums, badges,
  JSON fields, machine-readable lists), not just prose — and across SIBLING files (index ↔ detail).
- **DC-16e (NEW — over-correction introduces a new unbacked claim):** replacing an unbacked number with a SMALLER
  unbacked number ("<50ms" → "sub-millisecond") fixes nothing. Cue: a replacement perf/quant claim must be backed
  by an in-repo artifact, or carry no magnitude.
- **DC-16b recurrence (completeness):** x402 demoted on `[slug]` but not the sibling index page — re-scan EVERY
  representation across sibling files, not the single edited file.
