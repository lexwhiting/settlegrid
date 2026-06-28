# ② SEAL RECORD — honest-claims-sweep (launch-gate chunk #1) — 2026-06-27

**Closes:** G1-1, G1-2, G1-3, G1-4, G1-5 (the G1 "TRUTH" gate) in
`docs/tech-debt/LAUNCH-GATE-roadmap-2026-06-27.md`.
**Tier:** HIGH-STAKES. Scope was CLAIMS + one regression test only — no money/auth/settlement code,
no un-darking crypto. Spec: `docs/tech-debt/honest-claims-sweep-handoff-2026-06-27.md` (read against the
codebase, not re-derived). Brokered-count definition: `docs/audits/15-protocol-claim.md:67`.

---

## 1. GATE EVIDENCE (both repos — no shared gate spans both)

**settlegrid** (from `apps/web`):
- `npx tsc --noEmit` → exit **0**
- `npm run lint` → exit **0** (warnings only; zero errors)
- `npx vitest run` → **209 files / 4823 tests passed, 0 failed, 0 skipped**
- `npx vitest run src/__tests__/honest-framing-regression.test.ts` → **63 passed** (was **24 failed**
  pre-fix → **0 failed** post-fix; the +25 are the new G1-1..G1-4 file-scoped guards, incl. the
  protocols.tsx homepage guard added after the full-tree re-scan).

**settlegrid-agents** (from repo root):
- `npx vitest run` → **21 files / 866 tests passed, 0 failed**
- `npx tsc --noEmit` → exit **0**

**Prove-it-fails-first (G1-5 §5):** captured RED → GREEN.
- `stats-bar.tsx` `not.toMatch(/value:\s*"15"/)` — FAILED pre-fix (value:"15" present), PASSES post-fix.
- `servers/page.tsx` (and 5 more) `not.toMatch(/1,017 … templates/i)` — FAILED pre-fix, PASSES post-fix.
- All 13 latency surfaces + the docs/page.tsx crypto + USDT guards — RED pre-fix, GREEN post-fix.

Independent fresh-context verifier digest: **see §7** (subagent ran the full gate for both repos; env traps
`CLAUDE_CODE_FORK_SUBAGENT`/`SUBAGENT_MODEL`/`EFFORT_LEVEL` all unset → subagent-runs-gate path valid).

---

## 2. FOUNDER DECISIONS (§9) — surfaced; proceeded on the executable defaults (no reply needed)

1. **Canonical catalog headline + noun.** Applied the default noun-reconciliation (DC-16a):
   **1,017 = indexed open-source MCP servers** (`server-catalog.json`, rendered at `/servers`, **22 real
   categories** — verified by enumerating the catalog), **97 = forkable templates with billing pre-wired**
   (`registry.totalTemplates`, **6 categories**). Every surface relabeled to the noun that matches its
   number; no number fabricated. **Open Q for founder (unresolved):** is the public headline "1,017 indexed
   servers / 97 ready-to-fork templates", and is the indexed count **1,017** (catalog) or **1,444** (agents
   prompt `beacon/prompts.ts:18` "1,444+ tools indexed")? **These two still conflict** — I reconciled
   "991 forkable templates" → 97 but left "1,444+ tools indexed" untouched (flagged, not guessed).
2. **The verb "brokers" with x402 demoted from production.** Kept "9 brokered" / "brokers payments across 9
   protocols" everywhere (honest by the adapter-coverage definition; test-pinned in both repos). **Open Q
   for founder:** with x402's "(production)" annotation now demoted, does "brokers payments across 9
   protocols" over-imply live settlement vs "integrates/has adapters for 9"? Count kept; verb left for
   founder. A verb rewrite would be a separate cross-repo chunk (breaks ~10 test pins).
3. **G1-3 `<50ms`: remove vs back.** Default applied — **removed** the bare `< 50ms` stat and reworded all
   ~15 latency surfaces to the defensible architectural statement ("single sub-millisecond Redis balance
   check; metering batched asynchronously"). Nothing in-repo backs a fixed end-to-end `<50ms`. **Open Q:**
   if a real benchmark/SLA exists, the stat could be restored backed.

---

## 3. WHAT CHANGED — by blocker

### G1-1 — retired "15 protocols"
- `stats-bar.tsx`: `{ value: "15", label: "Payment protocols" }` → `{ value: "9", label: "Protocols
  brokered" }` (labeled to disambiguate from the test-pinned "14 … tracked"); the `<50ms` stat removed.
- `smart-proxy.tsx:8`: "15-protocol payment detection" → "Multi-protocol payment detection" (homepage).
- `blog-bodies/mcp-billing-comparison-2026.md`: "15-protocol support" → "multi-protocol support" (the
  hyphenated form the old `/15 protocols/` regex missed).

### G1-2 — count reconciliation by noun (NOT a find-replace)
- Relabeled "1,017 … templates" → "1,017 … **servers**" (number TRUE for the catalog, noun fixed):
  `servers/page.tsx` (title ×3 + 2 descriptions + H1 + hero), `server-search.tsx:111` placeholder,
  `tools/page.tsx:110` ("…across 22 categories" KEPT — **22 is the catalog's real category count**, so the
  handoff's "22→6" default would have created a NEW false claim; noun fixed instead),
  `(dashboard)/dashboard/tools/page.tsx:646` (surgical single-line edit — uncommitted slugify change
  untouched), `faq/page.tsx:56`, `llms.txt:267`, `README.md:26` + `:196`.
- Used **97** where "billing pre-wired / forkable template" is the explicit claim: `README.md:151`
  ("1,017 open-source templates with billing pre-wired" → "97 …").
- **KEPT 1,017** on the indexed/cataloged-SERVER surfaces (already honest, noun = servers):
  `learn/page.tsx:41`, `learn/handbook/page.tsx:175/231/714/716`. No edit.

### G1-3 — `<50ms` latency (removed/reworded, ~15 surfaces)
Stat removed from `stats-bar.tsx`. Prose reworded (no end-to-end number; "sub-millisecond Redis balance
check" is the backed claim) in: `smart-proxy.tsx:29`, `features.tsx:60`, `docs/page.tsx:669`,
`faq/page.tsx:227`, `use-cases/page.tsx:89/91`, `learn/glossary/page.tsx:58`,
`learn/how-mcp-billing-works/page.tsx:108/132/148`, `learn/protocols/[slug]/page.tsx:39`,
`README.md:50/67/135`, `llms.txt:41/251/260/275`, `llms-full.txt:31/46/403/415`,
`blog-bodies/mcp-server-free-tier-usage-limits.md:391` (dropped "guarantee").

### G1-4 — crypto "supported now" self-claims demoted (rails config-dark), USDT dropped
**settlegrid (Bucket A demotions — "in development / not currently available", never "coming soon"):**
- `docs/page.tsx`: `:75` (multi-currency — dropped crypto/**USDT**, crypto→in-dev), `:211` (dropped
  **USDT**, x402 crypto→in-dev), `:326` ("first x402 facilitator" → "building … (in development)"),
  `:330` (dropped **USDT**, settlement→in-dev), `:334` (additional capability→planned), `:338`
  (present-tense settlement→"when live"), `:673` ("supports … crypto (x402)" → fiat today, crypto in-dev).
  **USDT fully removed** from the repo (settlement is USDC-only; verified 0 residual `USDT`).
- `learn/protocols/[slug]/page.tsx`: x402 `status: 'Production'` → `'Testnet'` (**re-scan addition** beyond
  the handoff's explicit line list — see §4 flag); `:114` ("first x402 facilitator"→in-dev), `:118`
  ("supports x402 natively / verifies on-chain"→in-dev), Circle Nano `:320` (overview present-tense→
  in-dev/testnet), `:322` ("Supported on Base mainnet and Base Sepolia"→"Base mainnet pending go-live"),
  `:324` ("supports Circle Nano as a USDC payment method"→in-dev/testnet).
- `learn/protocols/page.tsx:261` ("supports … out of the box" → "integrates").
- `llms-full.txt`: `:274-275` (x402 facilitator→in-dev), `:292-293` (Circle support→integrating/testnet),
  `:406` ("supports … crypto"→fiat today, crypto in-dev).
- Lower-confidence / qualified: `academic/page.tsx:81` (dropped "x402" from the "use tools via" list),
  `mcp/[owner]/[repo]/page.tsx:235` (dropped "or x402 protocol" from the live pay path).
- **`components/marketing/protocols.tsx:60` (HOMEPAGE — caught by the full-tree re-scan, NOT in the
  handoff list; my first crypto grep was scoped to `app/` and missed `components/`):** "to stablecoin
  settlement — one integration" → "to emerging Bitcoin Lightning and stablecoin rails — one integration".
  Guarded: `HOMEPAGE_PROTOCOLS_TSX not.toMatch(/stablecoin settlement/)`. DC-16b completeness hole closed.
- Re-scanned `components/` + `lib/`: the only other "crypto-live" hits are internal settlement CODE
  (`lib/settlement/*`, x402/circle-nano engines — out of scope, money code) and `lib/email.ts:1576`
  ("Your settlement has been confirmed on-chain" — a transactional NOTIFICATION that only fires on an
  actual confirmed settlement, accurate when sent). `blog-posts.ts:362` ("MCP + x402 for crypto-native
  tools") left as adapter-coverage advice — flagged.

**settlegrid-agents (cross-repo — strip ONLY the `(production)`/`Status: production` annotation; x402 stays
in the 9; count "9" untouched):**
- `beacon/prompts.ts:10` "x402 (production)" → "x402"; `:18` "991 forkable templates" → "97".
- `protocol/prompts.ts:19` "(9 — production or pending GA)" → "(9)"; `:24` "Status: production in the Smart
  Proxy" → "Adapter wired into the Smart Proxy; on-chain settlement is config-gated"; `:86` "x402
  (production)" → "x402".
- `shared/config.ts:147` (CODE COMMENT) "x402 (production)" → "x402" — fixed but not regression-guarded
  (module tests can't see comments; per handoff §1 G1-5 #6, accepted out-of-regression-scope).

### G1-5 — regression test (file-scoped, fires pre-fix)
Extended `apps/web/src/__tests__/honest-framing-regression.test.ts` with 4 new describe blocks (G1-1/G1-2/
G1-3/G1-4), all file-scoped value-literals — never `\b15\b` / blanket `/1,017/` / shared `RETIRED_CLAIM`:
- G1-1: `stats-bar.tsx` `not.toMatch(/value:\s*"15"/)`; `smart-proxy.tsx` + blog body `/15[- ]protocols?\b/i`.
- G1-3: `LATENCY = /\b50\s?(?:ms|milliseconds)\b/i` over 13 marketing/public files (the `\b` bounds avoid
  false-tripping "150ms"/"$50K"/"50K ops"/"i < 50").
- G1-2: `TEMPLATE_COUNT_CONFLATION = /1,017\s+(?:open-source\s+)?(?:MCP\s+)?(?:server\s+)?templates/i` over 6
  forkable surfaces, plus a POSITIVE anchor that the handbook KEEPS "1,017 open-source MCP servers" (guards
  against over-correction stripping the true catalog count).
- G1-4: `docs/page.tsx` not.toMatch the two crypto-settled sentences + `not.toMatch(/USDT/)`.
Cross-repo mirror (NOT `guardrails.test.ts` — it imports no prompt): `beacon/__tests__/beacon.test.ts`
`not.toContain('x402 (production)')` + `toContain('x402')`; `protocol/__tests__/protocol.test.ts`
`not.toContain('x402 (production)')` + `not.toContain('Status: production in the Smart Proxy')` +
`toContain('x402')`.

---

## 4. SCOPE-BOUNDARY DECISIONS + FLAGS FOR ② (keep/demote calls)

**KEPT (Bucket B/C — adapter-coverage / education / API-factual / frozen 9-brokered) — verified NOT
crypto-live self-claims:**
- `docs/page.tsx:342` (the `/api/x402/verify|settle|supported` endpoints are real routes — factual API
  description), `:359` (adapter-layer generic), `:681`/`:706` (9-brokered list / adapter-coverage).
- `learn/how-mcp-billing-works/page.tsx:176`/`:194` (the canonical 9-brokered framing + market education).
- `learn/protocols/[slug]/page.tsx:116` (x402 flow education), `:390`/`:392` (L402 education).
- `use-cases/page.tsx:149`, `learn/page.tsx:65`, `llms.txt:254`, `llms-full.txt:403`/`:409`
  (protocol-set listings in the same adapter-coverage sense as "9 brokered").
- `changelog/page.tsx:157`, `about/page.tsx:82` (9-brokered framing). `compare/nevermined/*` (Nevermined's
  column, not a SettleGrid claim) — untouched per SCOPE-OUT.

**Flags for ② (borderline / out of this chunk's explicit scope — surfaced, not changed unless noted):**
- **F1 — x402 `status:'Production'` → `'Testnet'` (CHANGED).** Not in the handoff's explicit line list for
  `learn/protocols/[slug]/page.tsx`; surfaced by the G1-4 re-scan. Demoted to match the sibling dark crypto
  rail (Circle Nano = `'Testnet'`) so the prose demotion isn't contradicted by a "Production" badge. ②
  should confirm this is desired (vs. a new enum value like "In development").
- **F2 — MPP `status:'Production'` (line 62, NOT changed).** Non-crypto, outside G1-4's crypto scope; the
  audit frames Stripe MPP as "pending GA". Left as-is; flagged for a possible separate truth pass.
- **F3 — `learn/protocols/[slug]/page.tsx:390` (L402, NOT changed).** "first multi-protocol billing
  platform with deep L402 support … accept Bitcoin alongside fiat and stablecoin payments" — the handoff
  bounded `:390/:392` OUT as Bucket-C education, but "accept Bitcoin" / "deep L402 support" is borderline
  for a detection-only adapter. Left per the handoff's explicit boundary; flagged.
- **F4 — `1,444+ tools indexed` vs `1,017` catalog (NOT changed).** Founder reconciliation (§2.1, §9.1);
  reconciled 991→97 but left 1,444 (don't guess).

---

## 5. FROZEN / NOT TOUCHED (per SCOPE-OUT §2 + §7)
"9 brokered" count + framing; `mcp.json protocols[]` (test-pinned length 11); all money/auth/settlement
code; the dark-crypto config (fixed the CLAIM, never un-darked); `stats-bar.tsx` `:6/:7`
revenue-share + free-tier stats; generic protocol education + honest qualifiers ("(pending GA)",
"detection adapter", "tracked/emerging"); the uncommitted slugify change in
`(dashboard)/dashboard/tools/page.tsx`.

---

## 6. CROSS-REPO NOTE
`settlegrid-agents` is NOT under the settlegrid gate; it has its own suite (866 tests). The agents-repo
demotions + the two new negative guards (`beacon.test.ts`, `protocol.test.ts`) were run green there. The
settlegrid regression test covers only the settlegrid side. No shared gate spans both repos.

---

## 7. INDEPENDENT VERIFIER DIGEST
Fresh-context subagent (env traps unset → subagent-runs-gate path valid) ran all 6 gate commands and
returned **OVERALL VERDICT: GREEN**:
- `apps/web` `npx tsc --noEmit` → EXIT 0
- `apps/web` `npm run lint` → EXIT 0 (0 Error/parsing-error lines; warnings only)
- `apps/web` `npx vitest run` → EXIT 0, **209 files / 4822 passed / 0 failed / 0 skipped**
- `apps/web` honest-framing test → EXIT 0, **62 passed / 0 failed**; all four G1-1/G1-2/G1-3/G1-4 describe
  blocks present with verbatim-matching names, all passing
- `settlegrid-agents` `npx vitest run` → EXIT 0, **21 files / 866 passed / 0 failed**
- `settlegrid-agents` `npx tsc --noEmit` → EXIT 0

**Addendum (post-verifier):** the verifier ran on the state immediately before the
`protocols.tsx:60` homepage fix (found by the full-tree re-scan, §4). I re-ran the settlegrid gate myself on
the final state: `tsc` EXIT 0, `lint` EXIT 0, full `vitest` **209 files / 4823 passed / 0 failed**,
honest-framing **63 passed / 0 failed** (+1 homepage guard). The agents repo is byte-identical to the
verifier's green run (no edits since). Net final: **GREEN, both repos.**

---

## 8. READINESS FOR ②
All five G1 blockers closed with cited evidence; both repos GREEN; founder decisions surfaced with
executable defaults applied; four scope-boundary flags (F1–F4 in §4) raised for the seal-gating review.
Ready for ② (deep audit). The only judgment calls beyond the handoff's explicit lines are the §4 flags —
each is documented with its rationale.

---
---

# ② SEAL-GATING RECOVERY PASS — 2026-06-27 (after ② BLOCKED on §4 flags)

The first ② **BLOCKED** (could not seal) on the §4 flags above + a new over-correction class. Spec for this
delta: `docs/tech-debt/honest-claims-sweep-2-seal-blocked-recovery-2026-06-27.md`. This was a focused DELTA
on the existing uncommitted working tree — the §3 work above is PRESERVED, not redone. Run at
`claude-opus-4-8[1m]`.

## R1. WHAT THE RECOVERY CHANGED — by finding

### B1 — x402 INDEX-page badge self-contradiction (closes §4 F1's sibling, DC-16d)
- `learn/protocols/page.tsx:67` x402 `status: 'Production'` → **`'Testnet'`**. The detail page already read
  `'Testnet'` + "native x402 support is in development"; the index badge was the un-demoted sibling
  representation (a status ENUM is a self-claim — grep-on-prose missed it). The `:68` oneLiner (protocol
  education) was KEPT.

### B2 — L402 false-while-dark self-claims demoted (FOUNDER-AUTHORIZED badge-layer harmonization)
Grounding: `isL402Enabled()` (`lib/env.ts:298` = `L402_ENABLED==='true' || !!LND_REST_URL`) is config-dark
in prod → mock invoices only; canonical framing already classes L402 as **detection-adapter-only (NOT
brokered)** (`llms.txt:261`, `protocols.tsx:27`).
- `learn/protocols/page.tsx:150` (index) L402 `status: 'Ready'` → **`'Testnet'`**.
- `learn/protocols/[slug]/page.tsx:388` (detail) L402 `status: 'Ready'` → **`'Testnet'`** (mirrors the
  sibling dark crypto rails x402/Circle, both `'Testnet'`).
- `[slug]:390` overview — stripped "**first** multi-protocol billing platform with **deep L402 support** …
  **accept Bitcoin** alongside fiat and stablecoin payments" → "SettleGrid tracks L402 as a **detection
  adapter**; native Lightning settlement is **in development and not currently available**." L402 protocol
  education (what L402 IS) KEPT.
- `[slug]:394` integration — "**deep L402 integration** … **Every tool on the platform can accept
  Lightning** …" → "SettleGrid's native L402 support is **in development and not currently available**. The
  Smart Proxy has an L402 **detection adapter** that verifies the macaroon signature chain …" (mirrors the
  already-demoted x402 integration wording).
- `public/llms-full.txt:299` — "**Native** Bitcoin Lightning micropayments …" → "SettleGrid has an L402
  **detection adapter (in development; native Lightning settlement not currently available)** …" (mirrors
  the already-demoted Circle entry at `:293` in the same file).
- **KYAPay call (also detection-adapter-only, badged `'Ready'`): LEFT `'Ready'`, prose unchanged.**
  Rationale: KYAPay's only assertion is **local JWT verification** ("verification is entirely local" — true:
  pure RS256/HS256 crypto, no network round-trip, no dark dependency), so `'Ready'` (adapter ready) is
  honest for it. `'Testnet'` would be WRONG (KYAPay is not a crypto/testnet rail) and `'Pending'` (used for
  spec-not-finalized rails) would understate it. The L402/KYAPay badge difference reflects a genuine
  maturity difference, not inconsistent honesty. Documented per recovery-doc B2's "note the call".

### B3 — MPP "Production" vs canonical "pending GA" (closes §4 F2) — VERIFIED FIRST
**Verified MPP's true status before demoting:** the rail is env-gated — `isMppEnabled()` ===
`!!process.env.STRIPE_MPP_SECRET` (`lib/env.ts:138`); `api/proxy/[slug]/route.ts:475` only dispatches MPP
when enabled; `docs/page.tsx:1854` documents `STRIPE_MPP_SECRET` as an **optional** enable-flag ("SettleGrid
works without it"). **6 canonical surfaces already frame MPP "pending GA"** (`docs:54`, `faq:48`,
`how-mcp-billing:176`, `api/chat:33`, plus the README/llms protocol lists) — the protocol pages'
`'Production'` + "every tool automatically accepts SPTs / zero config" was the inconsistent outlier.
- `learn/protocols/page.tsx:57` (index) + `[slug]:62` (detail) MPP `status: 'Production'` → **`'Ready'`**
  (aligns with the other brokered non-GA fiat rails AP2 / Visa TAP / UCP / ACP, all `'Ready'`).
- `[slug]:64` overview — "deep, native MPP integration — **every SettleGrid tool automatically accepts**
  SPTs … with **zero configuration**" → "SettleGrid's MPP integration is **pending general availability**:
  when enabled via the Smart Proxy, SettleGrid tools accept SPTs …".
- `[slug]:68` integration — "deep, native MPP integration. **Every tool** … **automatically accepts** SPTs
  … **no configuration needed**" → "pending general availability and is **enabled per deployment via the
  `STRIPE_MPP_SECRET` configuration**. When enabled, SettleGrid tools accept SPTs …" (the technical
  validation flow KEPT).
- `[slug]:92/:98` MPP code-example comments — "zero config needed" / "accepted automatically" softened to
  "once MPP is enabled (pending GA)" / "When MPP is enabled, …" (same self-claim family, same file —
  completeness, DC-16b).

### T1 — over-corrected "sub-millisecond" magnitude dropped (DC-16e, default applied)
The §3 G1-3 work replaced an unbacked `<50ms` with an equally-unbacked "sub-millisecond" Redis claim.
`lib/redis.ts` uses `@upstash/redis` (HTTP/REST) → from a serverless function the balance check is a network
round-trip, not sub-ms. **Default applied — dropped the magnitude** across **19 marketing/public surfaces** →
"a single Redis balance check **on the hot path**; metering batched asynchronously" (architectural claim
kept, number gone): `smart-proxy.tsx:29`, `features.tsx:60`, `docs/page.tsx:491`, `faq/page.tsx:227`,
`use-cases/page.tsx:89`, `learn/glossary/page.tsx:58`, `learn/how-mcp-billing-works/page.tsx:108/132/148`,
`learn/protocols/[slug]/page.tsx:39`, `README.md:50/67/135`, `llms.txt:41/251/260`,
`llms-full.txt:31/46/415`. **LEFT untouched (not public perf claims):** the settlement-code timestamp
comments ("sub-millisecond microseconds" in `lib/settlement/*`) and `api/dashboard/developer/api-keys`
lock-contention comment. Founder override (cited Upstash benchmark) remains available — restore wording +
guard in lockstep.

### T2 — docs:239 "supports … USDC" denomination qualifier
`docs/page.tsx:239` is the multi-currency **billing** FAQ (USDC as a unit of account). Added a one-clause
qualifier: "USD, EUR, GBP, JPY, and USDC **as billing denominations (units of account for pricing and
invoicing — distinct from on-chain crypto settlement)**." Documents why denomination is honest here while
the on-chain-settlement surfaces (`:75` etc.) were demoted.

## R2. NEW REGRESSION GUARDS — PROVEN RED → GREEN
Extended `apps/web/src/__tests__/honest-framing-regression.test.ts` with two new describe blocks (+17
file-scoped value-literal assertions; the G1-3 comment that said "sub-millisecond is allowed" was corrected):
- **B1/B2/B3 badge layer (6 assertions):** new `PROTOCOLS_INDEX = repoFile('…/learn/protocols/page.tsx')` +
  reused `PROTOCOL_SLUG_TSX`. Badge guards are scoped to the individual protocol entry via the
  `backer:'…',\s*status:'…'` pairing — **never a bare `/Production/`** (MCP/REST are legitimately Production)
  or `/Ready/`. Self-claim guards: `not.toMatch(/deep L402 (support|integration)/i)`,
  `/every tool on the platform can accept Lightning/i`, `/accept Bitcoin alongside fiat/i`,
  `/deep, native MPP integration/i`, `/automatically accepts Stripe Shared Payment Tokens/i`, and the
  llms-full L402 `not.toMatch(/^Native Bitcoin Lightning micropayments/m)`.
- **T1 sub-ms (11 assertions):** `SUBMS_MAGNITUDE = /sub-?millisecond|sub-?ms\b/i` over the 11 public files
  that carried it.
- **RED→GREEN captured:** pre-fix run = **17 failed / 63 passed** (the 17 new guards all RED; the 63
  existing guards unperturbed); post-fix run = **80 passed / 0 failed**. Each new guard fires on the exact
  retired surface and was confirmed RED against the current (pre-fix) tree before the source edits.

## R3. FINAL BADGE STATE (index ↔ detail now consistent)
MCP `Production` · MPP `Ready` · x402 `Testnet` · Circle `Testnet` · REST `Production` · L402 `Testnet` ·
KYAPay `Ready` — identical on both `learn/protocols/page.tsx` and `[slug]/page.tsx`. No sibling now
contradicts another.

## R4. GATE EVIDENCE (clean isolated runs — recovery final state)
**settlegrid** (from `apps/web`):
- `npx tsc --noEmit` → EXIT **0**
- `npm run lint` → EXIT **0** (12 pre-existing warnings, **0 errors**)
- `npx vitest run` → **209 files / 4840 tests passed, 0 failed, 0 skipped** (the §3 baseline 4823 + 17 new
  guards = 4840)
- `npx vitest run src/__tests__/honest-framing-regression.test.ts` → **80 passed** (RED→GREEN per R2)

**settlegrid-agents** (from repo root — NO edits this pass; the §3 agents demotion is frozen/correct):
- `npx tsc --noEmit` → EXIT **0**
- `npx vitest run` → **21 files / 866 tests passed, 0 failed**

## R5. DEFERRED (routed to follow-up per recovery-doc §5 — NOT fixed here)
- **F-data — ≥63 dead fork links:** `server-catalog.json` 1017 entries vs 954 committed
  `open-source-servers/` dirs; "fork any" overstates. Pre-existing catalog drift, not a wording defect this
  chunk created. → launch-gate queue / data task.
- **F4 — "1,444+ tools indexed"** (`agents/beacon/prompts.ts:18`): stale; founder reconciliation.
- **faq-vs-servers billing-verb nit** ("add your API key" vs "add SettleGrid billing"): conservative, not
  false; optional tighten.
- **Optional test robustness (recovery-doc §4, deferred):** `TEMPLATE_COUNT_CONFLATION` adjective-stack
  could be broadened; `(dashboard)/dashboard/tools/page.tsx:646` not in the conflation file-list; `/USDT/`
  not word-bounded. Noted, not changed (no new false claim depends on them).

## R6. COMMIT HYGIENE (SEAL-time — NOT done here; left staged-clean per kickoff)
Tree left uncommitted for the seal. At seal time, the claims + regression-test files commit together,
EXCLUDING: `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (own commit); the FROZEN slugify
hunk inside `(dashboard)/dashboard/tools/page.tsx` (patch-stage only — this pass did NOT touch that file);
untracked cross-chunk paths (`.claude/`, `launch-gate-queue.md`, the v-n3 handoff, `scripts/mfa-delete-smoke.sh`).
NEVER `git add -A` / `git commit -a`.

## R7. READINESS FOR RE-②
B1/B2/B3 (§4 flags F1 sibling, F2, F3) closed; T1 over-correction (DC-16e) and T2 denomination resolved;
badge layer harmonized index↔detail with the KYAPay call documented; the protocol-status-badge guard gap
(why B1/B2 shipped) is closed with proven-RED guards; both repos GREEN. Founder-authorized scope (L402 +
badge harmonization) applied per the recovery doc. **Ready for re-② (seal gate).**

---
---

# ② SEAL-GATING RECOVERY PASS — ROUND 2 — 2026-06-27 (after the SECOND ② BLOCK)

The second ② **BLOCKED** on B4 (a live MPP self-claim in `docs/page.tsx` that B3 demoted on the protocol
pages but never re-scanned to its `docs`/`llms` siblings — DC-16b/DC-16d recurrence) + B5 (asymmetric
guard coverage — DC-16f). Spec: `docs/tech-debt/honest-claims-sweep-2-seal-blocked-recovery-round2-2026-06-27.md`.
A focused DELTA on the existing uncommitted tree — the round-1 recovery (R1–R7 above: B1 x402-index, B2 L402,
B3 MPP-badge, T1 sub-ms, T2 denomination + the badge-layer guards) is PRESERVED, not redone. Run at
`claude-opus-4-8[1m]`, xhigh effort. **Scope = public CLAIMS/prose + the one regression test ONLY** — no
money/auth/settlement code; no rail un-darkened to make a claim true.

## RR2-1. WHAT CHANGED — by finding

### B4 [HIGH] — `docs/page.tsx` "Accepting MPP Payments" section + the `llms-full.txt` soft sibling
Grounding re-verified first-hand: `isMppEnabled()` is literally `return !!process.env.STRIPE_MPP_SECRET`
(`lib/env.ts:138`); the proxy dispatches MPP only `if (isMppEnabled() && isMppRequest(request))`
(`api/proxy/[slug]/route.ts:475`); `docs/page.tsx:1854` of the SAME section already documents
`STRIPE_MPP_SECRET` as the enable-flag. So "zero configuration required" / "natively accepts" was false
(config IS required) and self-contradicted both `:1854` and the chunk's own B3 protocol-page demotion
(pending GA). The 4 canonical FAQ/chat surfaces (`docs:54`, `faq:48`, `how-mcp-billing:176`, `api/chat:33`)
already frame "Stripe MPP … pending GA" — the `id="mpp"` section was the un-demoted outlier.
- **`docs/page.tsx:1812`** (section framing): *"SettleGrid natively accepts Stripe MPP … Any agent … can pay
  … seamlessly — zero configuration required."* → *"SettleGrid's MPP integration is pending general
  availability: when enabled per deployment via the `STRIPE_MPP_SECRET` configuration, SettleGrid tools
  accept Stripe MPP (Machine Payments Protocol) Shared Payment Tokens alongside traditional API keys."*
  (mirrors the protocol-page wording at `[slug]/page.tsx:64/:68`; the env-var is wrapped in the page's
  existing `<code>` style for consistency with `:1854`).
- **`docs/page.tsx:1850`** (Key Details → Dual payment): *"Tools accept both MPP (SPT) and traditional API
  key payments. No code changes needed on the developer side."* → *"When MPP is enabled, tools accept both
  MPP (SPT) and traditional API key payments."* (dropped the absolute "no code changes / zero config").
- **`public/llms-full.txt:272`** (soft sibling, DC-16d): *"SettleGrid supports MPP for Stripe-native and
  Tempo-based machine-to-machine payment flows with automatic metering."* → *"SettleGrid's MPP integration
  is pending general availability: when enabled per deployment via STRIPE_MPP_SECRET, SettleGrid meters
  Stripe-native and Tempo-based machine-to-machine payment flows."* (mirrors the demoted x402/Circle/L402
  entries in the same `## Protocol Support` section, e.g. `:275/:293/:299`).
- **KEPT as mechanism education** (the spec's explicit boundary): the "How MPP Works" numbered flow
  (`:1816–1822`) and the cURL example (`:1824–1846`, incl. `# Response: 200 OK`) — they describe the designed
  flow, not a live availability claim; the section now LEADS with "pending GA / when enabled".

### FULL MPP RE-SCAN (DC-16d — every representation triaged, not just the patched lines)
`git grep -niE "(natively|zero config|automatically accepts|no code changes|supports?/accepts? MPP|MPP … supported)"`
over `apps/web/src apps/web/public README.md` (excluding the giant single-line data files
`server-catalog.json`/`registry.json`) + the `settlegrid-agents` repo. Every hit triaged:

| Surface | Verdict | Why |
|---|---|---|
| `docs/page.tsx:1812` | **DEMOTE (B4)** | live self-claim ("natively accepts … zero config") |
| `docs/page.tsx:1850` | **DEMOTE (B4)** | absolute "no code changes needed" |
| `llms-full.txt:272` | **QUALIFY (B4)** | bare present-tense "supports MPP …" → pending-GA |
| `docs/page.tsx:706` | KEEP | multi-protocol adapter-coverage FAQ list (Bucket B/C; kept in §4) |
| `faq:227`, `faq:48`, `docs:54`, `api/chat:33`, `how-mcp-billing:176` | KEEP | frozen 9-brokered lists — already carry "pending GA" |
| `templates/index.html:159` | KEEP | generated artifact; multi-protocol "automatically support" coverage list, same framing as `docs:706` |
| `learn/protocols/[slug]/page.tsx:64/:68/:92/:98` | KEEP | already demoted round-1 B3 ("pending GA" / "when MPP is enabled") |
| `README:124`, `llms-full:18/403/409`, `.well-known/mcp.json:13` | KEEP | frozen brokered/tracked protocol lists (mcp.json test-pinned len 11) |
| **agents** `beacon/prompts.ts:10`, `protocol/prompts.ts:157`, `shared/config.ts:148` | KEEP — **no edit** | already "Stripe MPP (pending GA)" / "launch pending GA" |
**Result:** B4/B5 are settlegrid-only, exactly as the spec predicted. The agents repo needed NO MPP edit
(verified its 3 MPP representations are already pending-GA-framed) and is byte-identical to round-1.

### B5 [MED] — x402 detail-page badge guard (asymmetric coverage closed, DC-16f)
The round-1 B1 guard pinned only `PROTOCOLS_INDEX`; the x402 detail badge (`[slug]/page.tsx:111-112`,
`backer: 'Coinbase', status: 'Testnet'`) was demoted Production→Testnet in this sweep but UNGUARDED — a
regression flipping it back to `'Production'` would have passed. Merged the detail guard into the existing
x402 badge test: `expect(PROTOCOL_SLUG_TSX).not.toMatch(/backer: 'Coinbase',\s*status: 'Production'/)`
(verified the detail backer string is exactly `'Coinbase'`, like the index — unlike L402's
index `'Lightning Labs'` vs detail `'Lightning Labs (Bitcoin)'`). **Corrected the inaccurate comment**
(was "the [slug] detail page already reads 'Testnet'"): the detail badge was `'Production'` at HEAD and
demoted in THIS sweep, NOT "already" Testnet — comment now states both index+detail were demoted here and
are pinned for DC-16f symmetry.

### T3 [borderline, NOT blocking] — L402 'Testnet' badge: DEFAULT applied = KEEP
Proceeded on the default: kept `'Testnet'` (harmonized with the sibling dark crypto rails x402/Circle; the
L402 prose is honest — "detection adapter; native Lightning settlement in development and not currently
available"). NOT demoted to `'Pending'`. No L402 badge/guard change this pass (the founder-precision option
remains available — if taken, update the L402 index+detail badge guards in lockstep). **T4 SKIPPED** per
spec (Testnet≡Production amber styling is pre-existing and out of claims-text scope).

## RR2-2. NEW REGRESSION GUARDS — PROVEN RED → GREEN (both runs captured)
Extended the B1/B2/B3 describe block in `apps/web/src/__tests__/honest-framing-regression.test.ts`
(file-scoped value-literals; `DOCS_PAGE_TSX`/`LLMS_FULL_TXT`/`PROTOCOL_SLUG_TSX` already defined in-file):
- **B4 (docs):** `expect(DOCS_PAGE_TSX).not.toMatch(/zero configuration required/i)` +
  `not.toMatch(/natively accepts Stripe MPP/i)`.
- **B4 (llms-full soft sibling):** `expect(LLMS_FULL_TXT).not.toMatch(/^SettleGrid supports MPP for Stripe-native/m)`.
- **B5 (x402 detail):** added `expect(PROTOCOL_SLUG_TSX).not.toMatch(/backer: 'Coinbase',\s*status: 'Production'/)`
  to the existing x402 badge test (renamed "index + detail x402 badge is not Production").

**RED capture (pre-fix tree, source un-demoted):** `npx vitest run src/__tests__/honest-framing-regression.test.ts`
→ **82 tests | 2 failed** — exactly the two new B4 guards RED:
  `× docs page MPP section drops "natively accepts / zero configuration"` (matched `/zero configuration required/i` at `docs:1812`)
  `× llms-full.txt MPP entry no longer leads with bare "SettleGrid supports MPP for Stripe-native"` (matched at `:272`).
  The B5 guard PASSED pre-fix (detail badge already `'Testnet'` — it is protective coverage, GREEN pre & post,
  by design; the round-1 demotion it pins is already in the tree).
**GREEN capture (post-fix):** same command → **Test Files 1 passed · Tests 82 passed / 0 failed.**

## RR2-3. GATE EVIDENCE (both repos — no shared gate spans both; clean isolated runs, final state)
**settlegrid** (from `apps/web`):
- `npx tsc --noEmit` → EXIT **0**
- `npm run lint` → EXIT **0** (12 pre-existing warnings, **0 Error lines**)
- `npx vitest run` → EXIT **0**, **209 files / 4842 tests passed, 0 failed, 0 skipped** (round-2 baseline
  4840 + 2 new B4 tests = 4842; B5 merged into an existing test, no count change)
- `npx vitest run src/__tests__/honest-framing-regression.test.ts` → **82 passed** (RED 2-fail → GREEN per RR2-2)

**settlegrid-agents** (from repo root — NO edits this pass; verified its MPP claims already pending-GA-framed):
- `npx tsc --noEmit` → EXIT **0**
- `npx vitest run` → EXIT **0**, **21 files / 866 tests passed, 0 failed**

## RR2-4. COMMIT HYGIENE (SEAL-time — NOT done here; tree left uncommitted/staged-clean)
Per round-2 recovery-doc §8: at seal time the claims + regression-test files commit together, EXCLUDING
`docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (own commit); the FROZEN slugify hunk inside
`(dashboard)/dashboard/tools/page.tsx` (patch-stage only the `:646` line via `git add -p` — this pass did
NOT touch that file); untracked cross-chunk paths (`.claude/`, `docs/tech-debt/launch-gate-queue.md`, the
v-n3 MFA handoff, `scripts/mfa-delete-smoke.sh`). The `honest-claims-sweep-*.md` docs ARE in-scope.
**NEVER** `git add -A` / `git commit -a`. This delta touched only 3 source/test files
(`honest-framing-regression.test.ts`, `docs/page.tsx`, `llms-full.txt`) + this seal record.

## RR2-5. READINESS FOR RE-② (round 2)
B4 (the second-block blocker — MPP `docs`/`llms` self-claim) closed at root with the full MPP re-scan
triaged (every representation accounted for; agents repo confirmed already-correct, no edit); B5 asymmetric
guard gap (DC-16f) closed + the inaccurate B1 comment corrected; T3 resolved on the documented default
(KEEP L402 'Testnet'), T4 skipped per scope. The B4 guards were PROVEN RED on the pre-fix tree → GREEN after.
Both repos GREEN with cited exit codes + counts. The round-1 delta (B1/B2/B3/T1/T2 + badge guards) is
PRESERVED, unperturbed. Tree left uncommitted for the seal. **Ready for re-② (seal gate).**

---

# ② SEAL-GATING RECOVERY PASS — ROUND 5 — 2026-06-28 (after the FIFTH ② BLOCK)

Spec: `docs/tech-debt/honest-claims-sweep-2-seal-blocked-recovery-round5-2026-06-28.md`. The FIFTH block was
the 5th recurrence of the incomplete-sweep class (DC-16d/DC-16h): the round-4 B11 fix INTRODUCED a "live x402
facilitator" claim at `docs:326` but left five sibling FAQs on the SAME `/docs` accordion asserting the
categorical opposite ("on-chain crypto settlement … is in development and not currently available") — a live,
reader-visible self-contradiction. **FOUNDER PRE-CHECK = RESOLVED → RESOLUTION A LOCKED:** the public x402
facilitator is confirmed reachable in prod (DNS `facilitator.settlegrid.ai` → Vercel; `GET /v1/supported` →
200 with exactly Base mainnet `eip155:8453` + Base Sepolia `eip155:84532`; `POST /v1/verify` malformed → 422).
So the live-facilitator claims are KEPT and the demoted siblings re-scoped to the in-development PROXY/
platform-revenue path. The round 1–4 deltas (B1–B15, T1–T3, L3) are PRESERVED, unperturbed.

## RR5-1. WHAT CHANGED — by finding
- **B16 [BLOCKING] — docs `x402 & Crypto Settlement` cluster reconciled to ONE status.** Re-ran the exhaustive
  greps (`git grep -nE 'x402|on-chain|crypto settlement' -- apps/web/src/app/docs/page.tsx` + the cross-surface
  `git grep -niE 'in development|not currently available|when .{0,30}live|planned additional capability' --
  apps/web/src apps/web/public README.md`) and triaged **every** x402 hit as facilitator-service (live, KEEP)
  vs proxy/platform-revenue (dark, in-development). Re-scoped the WHOLE cluster, not the hand-listed subset:
  `docs/page.tsx` **:75, :211, :330, :334, :338, :359, :673** rewritten so each now says the standalone x402
  facilitator verifies+settles on Base today while settling the developer's OWN tool revenue on-chain through
  the hosted proxy/platform is in development. KEPT untouched: `:326`/`:342` (B11 live-facilitator claims),
  `:706` (B12 — already proxy-scoped "brokers through its Smart Proxy"), `:54`/`:681` (frozen "9 brokered").
  Cross-surface fold: `public/llms-full.txt:406` ("crypto settlement in development") scoped to the platform
  path + the live facilitator noted. `chat:71` + `llms-full:275` + `[slug]:114` neighbours re-examined — already
  facilitator-vs-proxy scoped (B11), no sibling gap; `:275` hostname KEPT (DNS confirmed). No `USDT`
  re-introduced; no B6/B12/G1-4/T1 retired phrase re-introduced.
- **B17 [MED] — x402 status badge reconciled.** `learn/protocols/page.tsx:67` + `[slug]:112` badge
  `'Testnet'` → **`'Production'`** — ONE consistent status matching the (frozen) facilitator landing page
  `protocols/x402/facilitator/page.tsx:111 status:'production'` (Base mainnet, live). `'Testnet' both
  under-claimed the live Base-mainnet facilitator and disagreed with the facilitator page. The platform/proxy
  x402 layer that remains pending is scoped by the overview prose. The round-1 B1/B5 guard (which forbade
  `'Production'`) is SUPERSEDED by this guard under Resolution A.
- **B18 [MED] — `[slug]:118` integration field reconciled.** Was "native x402 support is in development and
  not currently available" one sentence from naming three LIVE facilitator endpoints. Rewritten to lead with
  "SettleGrid runs a live standalone x402 facilitator" (the three `/api/x402/*` endpoints = the live
  facilitator) and scope the in-development part to settling through the hosted proxy on the developer's behalf.
  `[slug]:114` grammar nit fixed (em-dash form harmonized with `docs:326`) + proxy-scoped in the same edit.
- **LOW folds:** forward-only disclosure comments added beside the **B11#1 / B14 / B15** negative guards
  ("RED reachable only on the uncommitted round-3 build; sibling HEAD-anchored guard carries the teeth").
  `compare/nevermined:52 'x402 settlement layer'` SEO keyword ACCEPTED (kept — the live facilitator settles
  x402). `llms-full:275` hostname KEPT (DNS confirmed). DEFERRED with rationale (left untouched):
  `platform-agents.tsx:58` (adapter-coverage framing, test-pinned) + `use-cases:149` multi-hop (fiat
  session/budget primitive). T4 testnet-badge-color styling stays deferred.

## RR5-2. NEW REGRESSION GUARDS — PROVEN RED → GREEN
- **B16 — `describe('B16 — docs x402 cluster reconciled …')`** in `honest-framing-regression.test.ts`: one
  POSITIVE anchor pinning the live-facilitator claim (`docs:326` "runs a public x402 facilitator (verify +
  settle on Base mainnet and Base Sepolia)") + three NEGATIVE anchors pinning the retired categorical denials
  (the `:330`, `:211`, `:359` phrases, each unique to its FAQ). The negative-while-positive design is the
  anti-self-contradiction tripwire required by the spec.
- **B17 — `it('B17 — index + detail x402 badge reflects the live facilitator (Production)…')`**: replaces the
  superseded round-1 not-`'Production'` assertion; now `toMatch` Production + `not.toMatch` Testnet on BOTH the
  index and `[slug]` (file-scoped via the `backer: 'Coinbase'` pairing — never a bare `/Production/`).
- **RED→GREEN proof (deterministic):** pre-fix the three categorical phrases were present (`grep -c` = 1 each)
  and both badges were `'Testnet'` → the B16 negatives + B17 `toMatch(Production)` would FAIL; a node harness
  applied each guard regex to the verbatim pre-fix strings (all RED) and to the post-fix files (all GREEN).
  Captured both states. New `it` count: **+4** (B17 replaced one block in place; net suite move 93 → **97**).

## RR5-3. GATE EVIDENCE (both repos — clean isolated runs, final state)
**settlegrid** (from `apps/web`):
- `npx tsc --noEmit` → EXIT **0**
- `npm run lint` → EXIT **0** (pre-existing warnings only — `<img>`/hooks-deps/unused-disable; **0 Error lines**)
- `npx vitest run` → **209 files / 4857 passed, 0 failed** (round-4 baseline 4853 + 4 new B16 `it` blocks)
- `npx vitest run src/__tests__/honest-framing-regression.test.ts` → **97 passed** (RED → GREEN per RR5-2)

**settlegrid-agents** (from repo root — **NO edits this pass**; its prompts were already reconciled in round 4):
- `npx tsc --noEmit` → EXIT **0**
- `npx vitest run` → **21 files / 866 passed, 0 failed** (unchanged)

## RR5-4. FROZEN / NOT TOUCHED (re-confirmed)
"9 brokered" count + verb (`docs:54/:681/:706`, `stats-bar.tsx` `"9" / 95–100% / Free forever·50K` all
unchanged — stats-bar was NOT edited this round); `mcp.json` (len 11) NOT in diff; NO change under
`lib/settlement` / `env.ts` / `api/proxy` / `api/x402` / `api/circle-nano` / auth; the facilitator landing page
(`protocols/x402/facilitator/page.tsx` `status:'production'`) + `x402-facilitator-launch.md` untouched; the
uncommitted slugify hunks in `(dashboard)/dashboard/tools/page.tsx` NOT touched (not in this delta).

## RR5-5. COMMIT HYGIENE (SEAL-time — NOT done here; tree left uncommitted)
Unchanged from prior rounds' §8. This round-5 delta touched only **5 files**:
`apps/web/src/app/docs/page.tsx`, `apps/web/public/llms-full.txt`,
`apps/web/src/app/learn/protocols/page.tsx`, `apps/web/src/app/learn/protocols/[slug]/page.tsx`,
`apps/web/src/__tests__/honest-framing-regression.test.ts` + this seal record. At seal: commit the claims +
regression-test files + the `honest-claims-sweep-*.md` docs together; EXCLUDE the security-incident doc (own
commit), patch-stage ONLY the `:643` "1,017"→"servers" slugify hunk via `git add -p`, exclude untracked
cross-chunk paths. **NEVER** `git add -A` / `git commit -a`.

## RR5-6. READINESS FOR RE-② (round 5)
B16 (the blocking self-contradiction) closed at root under the LOCKED Resolution A: the whole `/docs` x402
cluster + the cross-surface `llms-full` sibling now state ONE consistent status (facilitator live; proxy/
platform settlement in development) with the contradiction pinned by a RED→GREEN guard. B17 badge + B18
integration field reconciled to the same status. LOW folds applied/deferred with rationale. Both repos GREEN
with cited exit codes + counts. Rounds 1–4 PRESERVED, unperturbed. Tree left uncommitted for the seal.
**Ready for re-② (seal gate).**
