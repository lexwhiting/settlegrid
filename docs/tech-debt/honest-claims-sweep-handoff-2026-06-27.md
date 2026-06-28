# ① BUILD HANDOFF — honest-claims-sweep — 2026-06-27 (REVISED after pre-build plan audit)

**Launch-gate chunk #1.** Closes blockers **G1-1, G1-2, G1-3, G1-4, G1-5** in
`docs/tech-debt/LAUNCH-GATE-roadmap-2026-06-27.md` (the G1 "TRUTH" gate).

**TIER: HIGH-STAKES** (confirmed by the pre-build plan audit — not merely recommended). Triggering
criteria: affects PUBLISHED public claims + a launch gate; DC-16 public-claim integrity on surfaces the
agent team AMPLIFIES at launch; touches the deliberately-FROZEN "9 brokered" framing; and carries
load-bearing JUDGMENT calls (the true catalog/template figures, the G1-4 boundary, the verb "brokers").
The *edits* are mechanical, but COMPLETENESS (catch every surface) and SCOPE-BOUNDARY (don't over-fix the
accepted framing, don't introduce a NEW false claim) are the real risk — review-grade, not build-complexity.

---

## ⚠ PLAN-AUDIT REVISION LOG (read this first — the original handoff had a load-bearing error)

A 6-lens pre-build plan audit (SEAM, LITERAL-EXECUTION, COMPLETENESS, SCOPE-BOUNDARY, TRUTH/ACCURACY,
REGRESSION-TEST-EFFICACY; all on claude-opus-4-8) materially corrected the original plan. The full
sustained-findings ledger is §10. The corrections that change what you build:

1. **G1-2 PREMISE WAS WRONG.** The original said "1,017 is ~10× the LIVE count of 97 templates." FALSE.
   There are **TWO real catalogs**: `apps/web/public/server-catalog.json` has **exactly 1,017 array
   entries** (the *indexed-server* catalog — what `/servers` actually renders, via
   `servers/page.tsx:6,40 import catalogData`), and `apps/web/public/registry.json` has
   `totalTemplates: 97` (the *forkable-template* catalog — what `/templates` renders). So "1,017" is the
   TRUE length of its own data source; the defect is **NOUN-CONFLATION** ("fork our 1,017 **templates**"
   when only 97 are forkable), NOT a fabricated number. **Do NOT blindly replace 1,017 → 97** — on the
   "cataloged/analyzed 1,017 servers" surfaces that would CREATE a new false claim. See §1 G1-2.
2. **THREE more inconsistent counts exist** (this is a reconciliation, not a find-replace):
   97 (registry templates) · 1,017 (server-catalog) · **991** ("forkable templates", agents
   `beacon/prompts.ts:18`) · **1,444** ("tools indexed", same line). `991 ≠ 97` is a real conflict.
3. **G1-1 missed two homepage/blog surfaces:** `smart-proxy.tsx:8` "15-protocol payment detection"
   (renders on the homepage via `page.tsx:83 <SmartProxy/>`) and
   `blog-bodies/mcp-billing-comparison-2026.md:83` "15-protocol support" (the hyphenated singular form
   that the EXISTING regex `/\b15 protocols\b/` does NOT catch).
4. **G1-3 had NO re-scan clause and is the single biggest completeness hole:** the "< 50ms" claim lives
   on **~15+ surfaces** (homepage `smart-proxy.tsx:29`, docs, faq, use-cases, learn/*, features.tsx,
   README, llms.txt, llms-full.txt, a blog body that says "guarantee"). Nothing in the repo backs a
   fixed "<50ms" (verified: kernel telemetry buckets to 5s; the only health threshold is p95<200ms).
5. **G1-4 named ~4 surfaces; the real count is ~25+.** `docs/page.tsx` ALONE has ~10 crypto-"supported"
   claims (only `:211` was listed); plus the whole `learn/protocols/[slug]` cluster, llms-full.txt, and
   the agents prompts have a SECOND production form (`protocol/prompts.ts:24`). Also `docs:211/:75/:330`
   claim "USDT" — settlement code is **USDC-only** (verified: zero `USDT` in lib/ or api/), so the
   demotion must DROP "USDT" too.
6. **G1-5 test design was wrong in two ways that defeat the gate:** (a) the planned "bare 15" pattern
   would NOT fire on the stats-bar SPLIT form AND would false-trip on "Next.js 15", "$0.15", and the
   `15-protocol-claim.md` citation — it must be a **file-scoped value-literal**, never a shared
   `RETIRED_CLAIM`, never `\b15\b`; (b) the planned mirror in `guardrails.test.ts` is the WRONG home
   (it imports no prompt) — crypto guards belong in `beacon.test.ts` + **`protocol.test.ts`**.
7. **"9 brokered" stays** (audit-decided). `docs/audits/15-protocol-claim.md:67` DEFINES it as "the count
   of adapters wired into the Smart Proxy's detection + dispatch chain … Does not claim all 9 are
   production-quality" — so it is honest BY DEFINITION even with rails dark. But demoting "x402
   (production)" removes the one live exemplar the audit cited, so the lead VERB "brokers" (lay-read as
   "settles money") gets a founder eyes-on (§9). Do not rewrite the count.

---

## 0. INTENT
Make every amplified public claim TRUE before promotion reactivates the agent team + outbound crons. There
is no automated fact-checker (the planned "Guardian" agent was never built), so claim-truth must be enforced
at the source + pinned by a regression test that ACTUALLY FIRES. Who consumes this: the founder (brand
integrity at launch), the agent team (Beacon/Protocol amplify these exact strings — see §3), and public AI
crawlers (llms.txt / README are training-data surfaces). What it enables: flipping G1 GREEN so the launch
gate can advance to chunk #2.

---

## 1. SCOPE — IN

### G1-1 — "15 protocols" — FALSE (the company's own audit retired "15"; honest count is 9)
Replacement value **"9" is verified correct** (matches the canonical brokered set in
`docs/audits/15-protocol-claim.md:45,67` and every prose surface). Surfaces:
- `apps/web/src/components/marketing/stats-bar.tsx:4` → `{ value: "15", label: "Payment protocols" }`
  (SPLIT strings — value and label are separate literals on lines 4 then the next entry).
- **`apps/web/src/components/marketing/smart-proxy.tsx:8`** → `"15-protocol payment detection"` —
  **HOMEPAGE** (`app/page.tsx:83 <SmartProxy/>`). *Added by the plan audit.*
- **`apps/web/src/lib/blog-bodies/mcp-billing-comparison-2026.md:83`** → `"…15-protocol support…"` —
  public blog body, in the test FILE_LIST but the existing regex misses the hyphenated form.
  *Added by the plan audit.*
- **Fix:** replace "15"→"9" (or **remove** the homepage stat entirely — both permitted). **Label the stat
  to disambiguate** from the test-pinned "14 agent payment protocols tracked"
  (`platform-agents.tsx:39`, pinned by `honest-framing-regression.test.ts:309 toContain('14')`): a bare
  "9 Payment protocols" next to "14 … tracked" is a NEW cross-surface inconsistency, and a context-free
  "9" re-implies 9 live money-moving rails. **Preferred:** label it "Payment protocols brokered" / "9
  settlement rails integrated", OR remove the stat. Keep consistent with whatever G1-4/§9 settles.

### G1-2 — template/server count — a 4-way RECONCILIATION (NOT a find-replace)
**The live data (verified):** `registry.json totalTemplates = 97` (forkable templates; `templates[]`
length 97; `categories` has **6** keys; `generatedAt: 2026-05-18` — STALE ~5wk). `server-catalog.json`
= **1,017** entries (indexed servers; rendered by `/servers`). Agents `beacon/prompts.ts:18` says "1,444+
tools indexed, 29 active, **991** forkable templates". Four numbers; the noun matters.

**Classify each surface by the NOUN it claims, then fix:**
- **"forkable TEMPLATES" surfaces — the false ones (only 97 are forkable):** `faq/page.tsx:56` ("Fork one
  of our 1,017 open-source templates"), `tools/page.tsx:110` ("1,017 … server templates across 22
  categories" — **also fix "22 categories"→6**, or to the catalog's real category count if binding to
  the catalog), `servers/page.tsx:11/13/24/26/32/34/98` ("1,017 … MCP Templates … billing pre-wired.
  Fork…"), `(dashboard)/dashboard/tools/page.tsx:646` ("1,017 open-source templates"),
  `components/server-search.tsx:111` (placeholder "Search 1,017 templates…"). **DEFAULT FIX:** these claim
  forkable templates → bind/set to **97** (`registry.totalTemplates`; live-bind where dynamic per §1 rule
  below, static literal in SEO `<title>`/metadata). `servers/page` is special — it RENDERS the 1,017-entry
  catalog, so its honest framing is "1,017 indexed servers, 97 ready-to-fork templates" (or bind the body
  count to `catalogData.length`); do NOT label 1,017 catalog entries "templates".
- **"INDEXED/CATALOGED/ANALYZED servers" surfaces — 1,017 is TRUE here, KEEP (do not → 97):**
  `learn/page.tsx:41` ("revenue benchmarks from 1,017 servers"), `learn/handbook/page.tsx:175` ("from
  1,017 … servers"), `:231` ("Based on analysis of 1,017 … servers"), `:714` ("1,017 Open-Source
  Servers"), `:716` ("We have cataloged 1,017 … servers"). 1,017 matches the catalog length; replacing
  with 97 would MISSTATE the benchmark population. Keep as-is, or live-bind to `catalogData.length` so it
  can't drift.
- **Public surfaces (in the test FILE_LIST already):** `README.md:26/151/196`, `apps/web/public/llms.txt:267`
  ("1,017 … server templates"). Apply the same noun classification.
- **Agents repo (cross-repo, §3):** `beacon/prompts.ts:18` "991 forkable templates / 1,444+ tools indexed"
  → reconcile "991"→97 (forkable); the "1,444 indexed" vs "1,017 catalog" gap is a **founder question**
  (§9) — flag, don't guess.
- **§1 LIVE-BIND RULE (concrete, per-file — the original rule was un-executable):**
  *if a server/client component renders the number in JSX body → `import { getRegistry }`/`catalogData`
  and interpolate the live value (precedent `templates/page.tsx:73 {registry.totalTemplates}`);
  if the number is inside a `const metadata`/`<title>` literal (static export) → write the same reconciled
  value as a hardcoded literal (do NOT convert to `generateMetadata` just for this);
  if it's prose like "analysis of N servers" → reword/keep, never silently bind 97.*
  **Per-page consistency (SEAM):** do NOT mix a live body count with a frozen `<title>` literal on the
  same page (`servers/page.tsx` metadata is a static export) — they would drift apart. Pick ONE per page:
  freeze ALL of that page's instances to the same regression-pinned literal, or bind all.
- **⚠ This is the founder reconciliation point (§9).** The default above is executable WITHOUT a founder
  reply; if the founder picks a different canonical headline, apply it instead.

### G1-3 — "< 50ms" latency — UNBACKED, pervasive (RE-SCAN family, not one surface)
**Nothing in the repo backs a fixed "<50ms"** (verified: `api/admin/kernel-health` buckets adapter
latency to 5s; the only health bound is p95<200ms in `launch-dashboard`; no perf test / SLA doc asserts
50ms). Surfaces (RE-SCAN with `grep -rniE "50 ?ms|sub-50|under 50|<50"` across `apps/web/src`,
`apps/web/public`, `README.md`, agents repo — non-exhaustive list):
`stats-bar.tsx:5`, `smart-proxy.tsx:29`, `docs/page.tsx:669`, `faq/page.tsx:227`, `use-cases/page.tsx:89/91`,
`learn/how-mcp-billing-works/page.tsx:108/132/148`, `learn/protocols/[slug]/page.tsx:39`,
`learn/glossary/page.tsx:58`, `components/marketing/features.tsx:60`,
`lib/blog-bodies/mcp-server-free-tier-usage-limits.md:391` ("sub-50ms latency **guarantee**" — strongest),
`README.md:50/67/135`, `public/llms.txt:41/251/260/275`, `public/llms-full.txt:31/46/403/415`.
- **DEFAULT FIX (executable now):** **remove** the bare "< 50ms Metering latency" stat AND sweep the prose
  to a defensible architectural statement that asserts no end-to-end number — e.g. "single sub-millisecond
  Redis balance check; metering batched asynchronously". Do NOT keep an unqualified "<50ms" anywhere.
- **Founder override (§9):** if a real, citable benchmark/SLA is supplied, the stat may stay backed and
  the prose is then defensible — but absent that artifact, default to removal/reword.

### G1-4 — crypto "supported/production/native/live" — FALSE while the on-chain rail is config-DARK
**Grounding (verified):** on-chain settlement is gated by `isX402SettlementEnabled()` (`lib/env.ts:190`;
`route.ts:1919` short-circuits when false) and `isCircleNanoKernelEnabled()` (`env.ts:261`); prod has the
payee/gas-wallet unset → DARK. Standing decision: crypto rails STAY DARK this promotion. So any claim that
SettleGrid CURRENTLY supports/settles crypto is false-while-dark. **USDT is doubly false** — settlement
code is USDC-only (zero `USDT` in lib/api).

**Use the three-bucket classification (the load-bearing distinction — do not over-fix):**

**Bucket A — "SettleGrid currently supports/settles crypto NOW" → DEMOTE.** (false self-claims)
- `app/docs/page.tsx` crypto cluster: `:75` ("crypto (USDC, USDT)"), `:211` ("Crypto payments are
  supported via the x402 protocol using USDC and USDT"), `:239` ("supports … and USDC"), `:326` ("first
  x402 facilitator"), `:330` ("supports USDC and USDT … for crypto settlement"), `:334` ("Crypto
  settlement is an additional capability"), `:338` ("verifies the on-chain payment, meters…"), `:342`
  ("/api/x402/supported returns supported stablecoins"), `:359` ("all supported protocols work
  automatically"), `:673` ("supports both fiat … and crypto (x402)"). *Original named only `:211`.*
- `app/learn/protocols/[slug]/page.tsx:114` ("first x402 facilitator"), `:118` ("SettleGrid supports x402
  natively. … verifies the on-chain transaction, credits…"), `:320/:322/:324` ("wires it … settles it
  on-chain from its own gas wallet" / "supports Circle Nano as a USDC payment method").
- `app/learn/protocols/page.tsx:261` ("supports the major … protocols out of the box").
- `apps/web/public/llms-full.txt:274-275` ("acts as a facilitator for the x402 payment protocol"),
  `:292-293` ("supports Circle's nanopayment protocol").
- Lower-confidence / qualify: `app/mcp/[owner]/[repo]/page.tsx:235`, `app/academic/page.tsx:81`,
  `app/use-cases/page.tsx:149`, `learn/how-mcp-billing-works/page.tsx:176`.
- **DEMOTION WORDING (verified safe):** drop the live verb AND "USDT"; prefer **"not currently available /
  in development / detection-only"** over "coming soon" (crypto is indefinitely dark; "coming soon"
  implies imminence). Keep x402/Circle Nano IN the brokered-list framing where they appear (see Bucket B).

**Bucket B — machine-readable "supported protocols" lists → FOUNDER-DECIDE, default KEEP.** These use
"supported"/"protocols" in the same adapter-coverage sense as the FROZEN "9 brokered" framing, and some are
**test-pinned** (changing them breaks the gate):
- `app/.well-known/mcp.json` static `protocols[]` — pinned `length 11` by
  `honest-framing-regression.test.ts:188`. **Do NOT alter** without updating the test in lockstep (out of
  scope; §9).
- `app/.well-known/mpp.json/route.ts:58` `protocols_supported: [...]`; `app/api/route.ts:15` endpoint
  self-advertisement. Flag to founder; **default keep** (consistent with keeping "9 brokered").

**Bucket C — generic protocol EDUCATION ("what x402/Circle/L402 IS") → BOUND OUT, do NOT touch.**
e.g. `learn/protocols/[slug]/page.tsx:116` (x402 flow), `:390/:392` (L402), `state-of-mcp-2026` market
tables, `lib/blog-bodies/ai-agent-payment-protocols.md`, and honest existing markers in prose
("(pending GA)", "detection adapter", "tracked/emerging", "x402 (Coinbase / Linux Foundation)" attributions
e.g. `api/chat/route.ts:33`). **DO-NOT-TOUCH:** demote only "currently supported/live/production"
assertions; leave education + honest qualifiers intact.

**NOT-A-SELF-CLAIM (do NOT change):** `app/compare/nevermined/data.ts:131` "x402 (primary, production)"
and `:144` describe **Nevermined's** column, not SettleGrid.

**Cross-repo (§3) — agents "x402 (production)" + a SECOND production form:**
`beacon/prompts.ts:10` ("x402 (production)"), `protocol/prompts.ts:86` ("x402 (production)"), **`:24`**
("Status: production in the Smart Proxy" — x402's status line), **`:19`** ("9 — production or pending GA"
header), `shared/config.ts:147` (comment "x402 (production)"). Demote the production STATUS only; **keep
x402's membership in the 9-list and the "9 protocols" count** (the agents tests pin both — §3).

### G1-5 — extend the regression test SO IT ACTUALLY FIRES (current test misses every live claim)
Existing test: `apps/web/src/__tests__/honest-framing-regression.test.ts` (reads files as text;
FILE_LIST = README, llms.txt, llms-full.txt, mcp.json, blog-posts.ts, 2 blog bodies, protocols.tsx,
platform-agents.tsx; POSITIVELY pins "9 brokered" + mcp.json length 11). It does NOT scan stats-bar,
smart-proxy, the 1,017 surfaces, docs/page.tsx, or the latency surfaces.

**Required (the original "add bare 15 / mirror in guardrails.test.ts" guidance was WRONG):**
1. **"15" guard — file-scoped value-literal, NEVER a shared `RETIRED_CLAIM`, NEVER `\b15\b`:**
   ```ts
   const STATS_BAR = repoFile('apps/web/src/components/marketing/stats-bar.tsx')
   expect(STATS_BAR).not.toMatch(/value:\s*"15"/)            // fires pre-fix, passes post-fix (value→"9" or removed)
   ```
   (Verified: "15" is a substring of no other stat value/label; `value:"95–100%"` is fine; a bare `\b15\b`
   would false-trip "Next.js 15" `README:192`, "$0.15" `blog-posts.ts:261/454`, and the
   `15-protocol-claim.md` citation in `protocols.tsx:5`/`platform-agents.tsx:5`.)
2. **Hyphenated form** for smart-proxy + the blog body: add `/15[- ]protocols?\b/i` scoped to those files
   (smart-proxy.tsx, mcp-billing-comparison-2026.md). Confirm it does NOT hit the `15-protocol-claim.md`
   citation strings (those live in protocols.tsx/platform-agents.tsx, which you can exclude or assert the
   citation is allowed).
3. **NEGATIVE assertions only on stats-bar** — a positive `toContain('9')` is VACUOUS (`"95–100%"`
   contains "9") and would FAIL the permitted "remove the stat" fix.
4. **"1,017" guard:** add the 8 surfaces to FILE_LIST and assert `not.toContain('1,017')` on the
   forkable-template ones; `README.md`/`llms.txt` are already scanned so a shared `/1,017/` (comma form)
   would auto-cover them. **But** the "indexed/cataloged servers" surfaces legitimately keep 1,017 — so
   pin per-surface, not a blanket `/1,017/`. (False-positive check: clean — `1,017` appears only in
   template/server-count context.)
5. **"<50ms" guard:** only if G1-3 resolves to REMOVAL (default). Pin `stats-bar.tsx` (and ideally the
   other scanned files) `not.toMatch(/<\s*50\s*ms|sub-50|under 50 ?ms/i)`. If the founder backs the
   claim, SKIP this guard (asserting absence would fail a valid kept claim).
6. **Crypto guard — split by repo:**
   - settlegrid side: add `docs/page.tsx` to FILE_LIST; pin the specific sentences, e.g.
     `not.toMatch(/Crypto payments are supported via the x402 protocol/)` and a guard for the `:330`
     "supports USDC and USDT … for crypto settlement" — pin sentences, NOT a broad `/x402.*supported/`
     (false-trips education).
   - agents side (§3): add to `beacon/__tests__/beacon.test.ts`
     `expect(BEACON_SYSTEM_PROMPT).not.toContain('x402 (production)')`; add to
     **`protocol/__tests__/protocol.test.ts`** (it imports `PROTOCOL_SYSTEM_PROMPT`)
     `not.toContain('x402 (production)')` **AND** `not.toContain('Status: production in the Smart Proxy')`
     (the second form). **NOT `guardrails.test.ts`** — it imports no prompt.
   - `shared/config.ts:147` is a CODE COMMENT — module-importing tests can't see it; either add a
     `readFileSync`-text assertion (beacon.test.ts already uses that pattern in its Security block) or
     accept it as out-of-regression-scope (fix the comment, don't guard it). Your call; note it.
7. **Prove-it-fails-first (§5):** the assertion in (1) MUST be shown red pre-fix (value:"15" present) and
   green post-fix. Likewise a `1,017` negative on one forkable-template surface. Capture both in evidence.
8. **Existing positive assertions survive** (verified): x402 stays in the 9-list, "brokers payments across
   9 protocols" untouched, mcp.json length 11 untouched — so README/llms/blog-posts/beacon/protocol
   positive anchors stay green. Don't perturb them.

---

## 2. SCOPE — OUT
- The **"9 brokered protocols" count + the verb "brokers"** — KEEP "9" (audit-decided; honest by the
  adapter-coverage definition `15-protocol-claim.md:67`). The verb is a founder eyes-on (§9), not a
  rewrite this chunk performs.
- **Bucket B machine-readable lists** (mcp.json/mpp.json/api route) — default KEEP; mcp.json is test-pinned.
- **Bucket C generic protocol education** + honest existing qualifiers — DO NOT TOUCH.
- The stats-bar stats NOT in G1 scope: `:6` "95–100% Revenue share" and `:7` "Free forever / 50K
  ops/month" — both **verified independently true** (take rate caps at 5% → ≥95% share; free tier is $0
  forever / 50K ops). Do NOT edit them (no gold-plating).
- Actually un-darking crypto; any money/auth/settlement code. This chunk is CLAIMS + the regression test
  ONLY.
- `compare/nevermined` Nevermined-column descriptions.

---

## 3. CROSS-REPO NOTE (G1-4 + G1-2)
The agents repo `/Users/lex/settlegrid-agents/` carries: the `"x402 (production)"` + "Status: production"
prompt claims (G1-4, §1) and the "991 forkable templates / 1,444+ indexed" counts (G1-2, §1). It has its
OWN honest-framing tests and is NOT under the settlegrid gate. **You must edit BOTH repos and run the
agents repo's own suite.**
- **Demotion must NOT break the agents tests** (verified pins): `beacon.test.ts` asserts the brokered
  array `toContain('x402')` (line ~142) and `/brokers payments across\s+9 protocols/` (~184);
  `protocol.test.ts` (lines ~147-320) pins `EXPECTED_PAYMENT_PROTOCOLS` length 14 + x402 in the brokered 9
  + the "15 payment protocols" negative; `config.ts` enum is machine-checked. SAFE demotion = strip only
  the `(production)`/`Status: production`/`production or pending GA` annotations; KEEP x402 in the 9 and
  the count "9". Removing x402 from the 9 or renumbering 9→8 BREAKS the gate.
- New negative guards go in `beacon.test.ts` + `protocol.test.ts` (§1 G1-5 #6), NOT `guardrails.test.ts`.
- Note the agents-repo change in the seal record — there is NO shared gate spanning both repos; the
  settlegrid regression test covers only the settlegrid side.

---

## 4. BUILD SEQUENCE
1. **Read this handoff + `docs/audits/15-protocol-claim.md` (the brokered-count definition) first.** Then
   surface the §9 founder questions; **proceed on the executable DEFAULTS** if no founder reply (do NOT
   block — every §9 item has a default). Record the decisions in the seal record (§6 path).
2. **G1-1** (stats-bar + smart-proxy + blog body; label the stat). **G1-3** (remove/reword the stat +
   sweep the ~15 latency surfaces — default removal). **G1-2** (reconcile by noun per §1; fix "22
   categories"→6; live-bind per the §1 rule, per-page consistency).
3. **G1-4** Bucket A demotions (both repos; drop "USDT"; "not currently available" wording); leave Buckets
   B/C. Re-scan: `grep -rniE 'x402.*(live|production|supported|natively)|crypto.*(supported|live|production)|(USDC|USDT|stablecoin).*(settl|support|live)'`
   over `apps/web/src` + `settlegrid-agents/agents` and triage each hit by bucket.
4. **G1-5** extend the regression test per §1 (file-scoped literals; prove-it-fails-first); mirror in
   `beacon.test.ts` + `protocol.test.ts`.
5. Gate (§5). Self-verify at the interval in directive (a) of the kickoff.

**⚠ Working-tree note:** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` has an UNCOMMITTED
unrelated change (a `slugify` helper + name/slug auto-fill, hunks ~221 and ~421). Your G1-2 edit is at
`:646`. Edit line 646 **surgically** — never `git checkout`/stash/full-file-rewrite this file or you'll
clobber that work. Do NOT add a bare-"15" scan to this file (`:732` has "amber-500/15").

---

## 5. GATE
- settlegrid (from `apps/web`): `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `npx vitest run` → all
  pass (incl. the EXTENDED honest-framing-regression test — PROVE it fails pre-fix on the stats-bar
  `value:"15"` + a `1,017` forkable surface, then passes after).
- settlegrid-agents: from that repo, `npx vitest run` (its `npm test` === `vitest run`) → green; `npx tsc
  --noEmit` → 0. Run as `cd /Users/lex/settlegrid-agents && npx vitest run` (a bare `cd` in a compound
  command can prompt; the `Bash(npx vitest *)` / `Bash(npx tsc *)` patterns cover the commands).
- **Allowlist (actual, verified in `.claude/settings.local.json`):** `Bash(npx tsc *)`, `Bash(npx vitest
  *)`, `Bash(npm run lint)`, `Bash(npm test)`, `Bash(git *)` — all present. (The original §5 list omitted
  `Bash(npm test)`; it IS granted.) Env traps unset (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL); no model
  pin → Opus 4.8.

---

## 6. SEAL BOOKKEEPING (LAUNCH-GATE — required)
On seal, tick **G1-1 G1-2 G1-3 G1-4 G1-5 ☐→☑** in `docs/tech-debt/LAUNCH-GATE-roadmap-2026-06-27.md`. The
PostToolUse hook (`.claude/launch-gate-check.sh`) auto-updates `cadence-state.json → launch_gate` and
advances `--next` to chunk #2 (public-surface-xss). Write the seal record to
**`docs/tech-debt/honest-claims-sweep-seal-record-2026-06-27.md`** (the named path the §9 decisions +
cross-repo agents change must be recorded in).

---

## 7. FROZEN / DO-NOT-PERTURB
The "9 brokered protocols" count + framing; the test-pinned mcp.json `protocols[]` (length 11); all
money/auth/settlement code; the dark-crypto config (fix the CLAIM, never un-dark to make a claim true);
the `:6/:7` revenue-share + free-tier stats; generic protocol-education content; honest existing qualifiers
("(pending GA)", "detection adapter", "tracked/emerging"); the uncommitted slugify change in
`(dashboard)/dashboard/tools/page.tsx`.

---

## 8. DEFECT-CLASS LEDGER
- **DC-16** (public-claim / content integrity) — the parent class. Detection cue: for any public stat,
  grep EVERY surface (SEO titles + public/ llms/README + the agent prompts in the sibling repo) and bind to
  a live source or pin the literal in the regression test.
- **DC-16a (NEW — noun-conflation / wrong-live-source):** a number can be TRUE for one catalog and FALSE
  for another (1,017 indexed servers ✓ vs 1,017 forkable templates ✗). Before "fixing" a count, confirm
  WHICH data source backs it and what NOUN the surface claims; a blind find-replace can introduce a new
  false claim. Cue: when reconciling a count, enumerate ALL candidate sources (here: registry 97 /
  server-catalog 1,017 / agents 991/1,444) and map each surface's noun to the right one.
- **DC-16b (NEW — completeness hole / single-surface scope):** a claim fixed on one surface but live on N
  others gives false confidence. Cue: every claim family gets a `grep -rniE` re-scan across both repos +
  public/, not a named-surface list.
- **DC-16c (NEW — split-string / hyphenated regression-test evasion):** a guard pattern that assumes a
  contiguous phrase (`/15 protocols/`) misses split literals (`value:"15"` … `label:"…protocols"`) and
  hyphenated forms (`15-protocol`). Cue: file-scoped value-literal assertions for split forms; `[- ]`
  class for hyphenated; NEGATIVE-only on removable surfaces; verify the guard FIRES pre-fix.
- **DC-16d–h (recovery rounds 1–5; see the recovery docs + seal-record for full detail):** the
  incomplete-sweep family — a status demotion that touches a NAMED subset and leaves SIBLINGS asserting the
  primitive live: d = sibling-prose-family (MPP section vs badge); e = same-page FAQ cluster; f =
  asymmetric guard (index pinned, detail not); g = universal-quantifier claim that names no rail
  ("settlement across every protocol"); h = demotion-induced contradiction across same-named primitives
  (facilitator service vs proxy revenue rail). Closed across rounds 1–6 (B1–B21). **6th recurrence
  (B19/B20/B21) CLOSED by the round-6 delta.** Cue: when you demote a primitive on ANY field/surface,
  re-scan and reconcile EVERY field of its entry (overview/howItWorks/integration/codeExample comments) +
  every cross-surface twin, reading semantically (keyword greps miss the universal/no-keyword forms).
- **DC-17 (uncommitted-chunk destructive revert):** on a 100%-uncommitted chunk, NEVER `git checkout`/
  `restore`/`stash` a tracked modified file to revert a temp edit — it loses the working-tree delta. Revert
  with an inverse `Edit` only. Every guard-teeth reviewer brief MUST forbid checkout/restore/stash. (Guard
  held in round 6.)
- **DC-18 (NEW — claim vs adapter RUNTIME, distinct from DC-16's claim vs config-STATUS):** a public prose
  claim contradicting the adapter IMPLEMENTATION (stub / always-fail / self-issued-JWT / sandbox-default),
  detectable only by tracing the runtime adapter code — invisible to a status-badge / config-gate
  reconciliation. Surfaced at the round-6 seal (F2–F6: Mastercard-VI/AP2/UCP/Visa-TAP/DRAIN on
  `/learn/protocols/[slug]`); OUT OF this chunk's bucket → the follow-up chunk
  (`detection-adapter-claims-vs-runtime-followup-2026-06-28.md`). Includes a potential financial-integrity
  angle (AP2/UCP phantom-credit to a withdrawable balance). Cue: a COMPLETE claims audit traces each rail's
  runtime, not just its status badge / config gate.

---

## 9. FOUNDER DECISIONS (surface these; proceed on the DEFAULT if no reply — do not block)
1. **Canonical catalog headline + noun.** Default: forkable-template surfaces → 97; indexed/cataloged-server
   surfaces → keep 1,017; reconcile agents "991 forkable"→97. Open Q for founder: is the public headline
   "1,017 indexed servers / 97 ready-to-fork templates"? And is the indexed count 1,017 (catalog) or 1,444
   (agents prompt)? (These conflict.)
2. **The verb "brokers" with x402 dark.** Default: keep "9 brokered" (honest by the adapter-coverage
   definition). Open Q: with x402 now demoted from "production", does "brokers payments across 9 protocols"
   over-imply live settlement vs "integrates/has adapters for 9"? (Keep the count; founder rules the verb.
   A rewrite would be a separate cross-repo chunk — it breaks ~10 test pins across both repos.)
3. **G1-3 <50ms: remove vs back.** Default: remove/reword (nothing in-repo backs it). Open Q: is there a
   real benchmark/SLA to cite? If yes, the stat may stay backed.

---

## 10. PLAN-AUDIT SUSTAINED-FINDINGS LEDGER (for ② to confirm each was folded)
All findings below were SUSTAINED (load-bearing ones re-verified by direct probe; none refuted). Severity ·
confidence in brackets; "→" = where folded.
- **[HIGH·HIGH]** server-catalog.json=1,017 ≠ registry 97; 1,017→97 blanket-swap creates a false claim on
  "cataloged servers" surfaces → §1 G1-2, Revision-Log #1, DC-16a.
- **[HIGH·HIGH]** smart-proxy.tsx:8 "15-protocol" on homepage, unlisted → §1 G1-1.
- **[HIGH·HIGH]** mcp-billing-comparison-2026.md:83 "15-protocol support" survives the existing regex →
  §1 G1-1 + G1-5 #2.
- **[HIGH·HIGH]** G1-3 single-surface scope; ~15 "<50ms" surfaces; nothing backs it → §1 G1-3.
- **[HIGH·HIGH]** G1-4 under-enumerated; docs/page.tsx has ~10 crypto-supported claims; learn/protocols
  cluster; llms-full.txt → §1 G1-4 Bucket A.
- **[HIGH·HIGH]** "USDT" unbacked (USDC-only settlement) → §1 G1-4 (drop USDT).
- **[HIGH·HIGH]** "bare 15" guard would false-trip (Next.js 15, $0.15, audit citation) + miss the split
  form → §1 G1-5 #1/#3.
- **[HIGH·HIGH]** crypto guard mis-homed (guardrails.test.ts has no prompt); belongs in
  beacon.test.ts+protocol.test.ts; second "production" form at protocol/prompts.ts:24 → §1 G1-5 #6, §3.
- **[HIGH·HIGH]** docs/page.tsx + the 8 "1,017" surfaces absent from FILE_LIST → §1 G1-5 #4/#6.
- **[MED·HIGH]** "22 categories" (tools:110) vs registry's 6 → §1 G1-2.
- **[MED·HIGH]** stale registry (generatedAt 2026-05-18) → §1 G1-2 (live-bind caveat).
- **[MED·HIGH]** "9" stat vs test-pinned "14 tracked" inconsistency → §1 G1-1 (label).
- **[MED·HIGH]** G1-4 ↔ "9 brokered" coupling: demoting x402 removes the audit's cited live exemplar →
  §9.2, Revision-Log #7.
- **[MED·HIGH]** bare "9 Payment protocols" stat strips tiered disclosure → §1 G1-1 (label/remove).
- **[MED·MED]** agents 991/1,444 extra inconsistent counts → §1 G1-2, §3, §9.1.
- **[MED·MED]** Bucket B machine-readable "supported" lists (mcp.json pinned len 11; mpp.json; api route)
  → §1 G1-4 Bucket B, §9.2 (default keep).
- **[MED·MED]** "coming soon" over-promises vs indefinite dark → §1 G1-4 ("not currently available").
- **[MED·HIGH]** live-bind-where-dynamic rule un-executable / templates/page is force-static-yet-binds →
  §1 G1-2 LIVE-BIND RULE.
- **[MED·HIGH]** per-page body-vs-title drift (servers/page static metadata) → §1 G1-2 consistency rule.
- **[MED·HIGH]** §4.1 "surface to founder" / template figure has no actionable default → §9 (defaults
  added).
- **[LOW·MED]** "~1,444/991" not in apps/web source (they're in the agents prompt) → §1 G1-2 (located).
- **[LOW·HIGH]** uncommitted slugify change in dashboard/tools/page.tsx → §4 working-tree note.
- **[LOW·MED]** §5 allowlist list omitted `Bash(npm test)` (actually granted); cd-into-agents can prompt →
  §5.
- **[LOW·LOW]** "the seal record" path unnamed → §6 (named).
- **[LOW·HIGH]** shared/config.ts:147 is a comment, unguardable by module tests → §1 G1-5 #6.
- **[LOW·HIGH]** existing positive assertions survive the demotion (no collision) → confirmed, §1 G1-5 #8.
