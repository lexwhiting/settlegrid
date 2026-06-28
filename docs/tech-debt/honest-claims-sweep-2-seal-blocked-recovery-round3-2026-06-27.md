# ② SEAL-GATING REVIEW (RE-②, round 3) — 🔴 BLOCKED → BUILD RECOVERY — honest-claims-sweep — 2026-06-27

**Outcome:** ② **BLOCKED** (could not seal). Routed to the recovery loop → back to build, then re-②.
This is the THIRD ② block. The first two blocks' deltas are **applied correctly and PRESERVED** — this is a
focused DELTA on the existing working tree, **NOT a redo**. The build is ~97% correct; the block is a
**third recurrence of the incomplete-sweep class (DC-16d)** — a cross-cutting FAQ + an orphaned static file +
a badge↔prose mismatch that a protocol-NAME-based re-scan missed.

**Gate is GREEN** (independently re-run from scratch this session — every check ran, evidence below):
settlegrid `tsc 0` / `lint 0` (warnings only) / `vitest 209 files · 4842 passed` (incl. honest-framing); agents
`tsc 0` / `vitest 21 files · 866 passed`. The vitest count moved 4840→**4842** vs the round-2 pre-build digest
— exactly the **+2 new B4 `it` blocks** (docs MPP guard + llms-full MPP guard), so the delta is fully accounted
for and the gate genuinely ran on the built code. **All frozen surfaces intact.**

**Review:** 4 decorrelated fresh-context Agent-tool lenses — completeness/SEAM (core-invariant) ·
spec-conformance · literal-execution/guard-teeth · scope-boundary/frozen+commit-hygiene — all
`claude-opus-4-8[1m]`. **Effort report-back: all 4 ran at `high`, NOT the operator-requested `xhigh`** (the
`/effort xhigh` switch did not take effect at spawn time; PATH 1 mixed-effort named-subagent defs do not exist,
and the Agent tool inherits session effort). `high` is the policy FLOOR for seal-deciding reviewers, so the
review is valid; recorded per the effort report-back guard. Because the outcome is BLOCKED on concrete,
integrator-verified findings (and the code will change in recovery), a same-pass `xhigh` re-run was **not** spent
— **ensure `/effort xhigh` is actually active before the NEXT re-② (the clean-seal confirmation pass).** Env
traps unset; allowlist GREEN (git/tsc/vitest/lint/npm test); operator chose Agent-tool spawns over a workflow.

Every load-bearing finding below was **live-reproduced first-hand by the integrator** against the built code
(file:line read + diff check) before triage.

---

## 1. WHAT THE BUILD GOT RIGHT — PRESERVE, do NOT redo
- **B4/B5/T3 all correctly applied** (spec-conformance lens, integrator-confirmed): docs `#mpp` section reframed
  "pending GA / enabled via `STRIPE_MPP_SECRET`" with the cURL/flow KEPT as education; `:1812` "natively
  accepts … zero configuration required" + `:1850` "No code changes needed" GONE; `llms-full.txt:272` MPP entry
  demoted with a pending-GA qualifier; B5 x402 detail-page badge guard (`PROTOCOL_SLUG_TSX not.toMatch
  /backer: 'Coinbase',\s*status: 'Production'/`) added + the inaccurate "already reads Testnet" comment fixed;
  T3 L402 kept `'Testnet'` with index+detail guards consistent.
- **Round-1 base intact:** "15"→"9" (relabeled "Protocols brokered"), `<50ms` removed, 1,017-templates
  noun-conflation fixed (forkable→97/"servers"; indexed-server surfaces KEEP 1,017), docs crypto cluster
  demoted, USDT fully dropped, agents `(production)` annotations demoted while x402 stays in the 9.
- **Guard teeth (verified empirically by the guard-teeth lens, 24/24 regex checks):** every B1/B2/B3/B4/B5 +
  G1-1/G1-2/G1-3/G1-4 negative guard fires RED pre-fix → GREEN now; no `\s`-newline false-pass, no wrong-file
  backer string (index `'Lightning Labs'` vs detail `'Lightning Labs (Bitcoin)'` correctly distinguished), no
  over-match on kept strings ("150ms"/"$50K"/"50K ops"/"1,017 … servers" all spared). **One quality nit only**
  — see L3 below.
- **Frozen intact** (scope lens, integrator-confirmed): "9 brokered" count + verb "brokers"; `mcp.json` NOT in
  the diff (length-11 pin untouched); no money/auth/settlement code; dark-crypto config not un-darked;
  stats-bar `:6/:7` unchanged; the uncommitted slugify hunks in `(dashboard)/dashboard/tools/page.tsx` (~:221,
  ~:421) untouched — only the `:646` "1,017"→"servers" edit is this chunk's.

---

## 2. BLOCKING FIX — the seal failed on this

### B6 — `docs/page.tsx:359` cross-cutting FAQ still claims x402 "works automatically" + "settlement across every protocol"  [MED·HIGH — BLOCKING]
*Completeness recurrence — DC-16d / new sub-class DC-16g (§6). The sweep demoted the NAMED x402 surfaces but
missed a UNIVERSAL-QUANTIFIER FAQ that sweeps ALL rails (incl. config-dark x402) into a live-settlement claim
WITHOUT naming x402 in a way a name-grep would catch. Flagged INDEPENDENTLY by two lenses; named in the
ORIGINAL handoff §1 G1-4 Bucket A "→ DEMOTE" and shipped UNCHANGED + UNGUARDED.*

`apps/web/src/app/docs/page.tsx`, FAQ "Do I need separate integrations for each protocol?" (currently ~:357-360):
> "No. SettleGrid's protocol adapter layer handles MCP, **x402**, AP2, Visa TAP, and REST transparently. You
> integrate once with the SDK and **all supported protocols work automatically**. The adapter layer normalizes
> authentication, metering, **and settlement across every protocol**."

**Why it's false / blocking (live-reproduced this session):**
1. It lists **x402** among protocols that "work automatically" and asserts SettleGrid does "**settlement across
   every protocol**" — but x402 on-chain settlement is config-dark (`isX402SettlementEnabled`; `route.ts:1919`
   short-circuits) and the SAME PAGE two FAQs up (`:326/:330/:334`) was demoted THIS sweep to "x402 … is in
   development and not currently available." So `/docs` now **self-contradicts** (in-development above,
   works-automatically below).
2. It was **explicitly named** for demotion in the build spec (handoff §1 G1-4 Bucket A: "`docs/page.tsx` …
   `:359` ('all supported protocols work automatically')") — this is a spec-conformance MISS, not a new
   discovery.
3. **Unguarded:** no honest-framing assertion covers the phrase (confirmed `git grep`).

**Apply (mirror the demotion pattern already used in this file's x402 cluster; do NOT over-fix the live rails):**
- Re-word so the universal claim does not sweep the config-dark rail in. e.g. "SettleGrid's adapter layer
  handles MCP, AP2, Visa TAP, and REST transparently through one SDK integration; x402 and other on-chain rails
  are in development. The adapter layer normalizes authentication and metering across supported protocols."
  (Keep MCP/AP2/Visa-TAP/REST as live — they are; drop x402 from the "works automatically/settles" set OR
  qualify it "in development"; soften "settlement across every protocol" so it does not assert live on-chain
  settlement.)
- **New regression guard (prove RED pre-fix → GREEN post-fix; capture both):** add a `DOCS_PAGE_TSX` assertion
  that pins the corrected claim — e.g. `expect(DOCS_PAGE_TSX).not.toMatch(/settlement across every protocol/i)`
  (fires RED on the current tree). Pin the exact retired phrase, not a broad pattern.
- **DC-16g re-scan (do NOT patch only :359):** `git grep -niE "(all|every|each)\s+\w*\s*protocols?.*(work|settl|automatic|transparent)|settlement across (every|all)"`
  over `apps/web/src apps/web/public README.md` and the agents repo; triage each universal-quantifier claim —
  does it implicitly assert the dark rails (x402/Circle/L402) or MPP settle live? Known sibling already in the
  net: **`docs/page.tsx:706`** ("…handles settlement automatically") — there it is the IN-BOUNDS brokered/
  detection coverage framing (it correctly separates L402/KYAPay as detection adapters), so the trailing verb is
  defensible; **default KEEP `:706`** but confirm it during the re-scan.

---

## 3. SHOULD-FIX — fold into the SAME delta (the protocol pages + public surfaces are already being reopened)

### B7 — MPP status badge `'Ready'` contradicts the new "pending general availability" prose  [MED·MED]
*Badge↔prose SEAM (DC-16d, representation-mismatch variant). Round-1 demoted MPP `'Production'→'Ready'`; B4
then added "pending general availability" prose on the detail page + docs + llms-full — so the badge word now
contradicts the prose word on the SAME page.*
- `apps/web/src/app/learn/protocols/page.tsx:57` and `[slug]/page.tsx:62` both read MPP `status: 'Ready'`.
  `StatusBadge` renders the bare enum word: `Ready` = **blue "Ready"** (reads as available now);
  `Pending` = gray (used by the emerging rails Mastercard VI / KYAPay). The detail page's own overview +
  integration prose (`[slug]:64`, `:68`) now says "**pending general availability** … enabled per deployment
  via `STRIPE_MPP_SECRET`." Badge says ready, prose says pending — a reader-visible self-contradiction.
- **Default fix:** demote MPP badge `'Ready'→'Pending'` on BOTH pages (matches the pervasive "pending GA"
  framing; conservative). Update the B3 MPP guard to also assert `not.toMatch(/backer: 'Stripe \+ Tempo',\s*status: 'Ready'/)`
  on both pages (keep index↔detail symmetric). **Founder option (judgment call, like T3):** keep `'Ready'` and
  reword the prose to "integration-ready; enabled per deployment via `STRIPE_MPP_SECRET`" (drop "pending general
  availability") so the two AGREE the other direction. Either way, badge and prose must use one consistent word.
  *(Taxonomy note: neither enum value perfectly captures "built but config-gated/pending-GA"; do NOT add a new
  enum value or restyle — that's scope creep. Pick `'Pending'` or align the prose.)*

### B8 — `apps/web/public/templates/index.html:159` claims automatic support + settlement for all 4 dark/pending rails  [MED-LOW·HIGH]
*Completeness miss — a static `.html` public asset never in any FILE_LIST or sweep across 3 rounds (the
re-scans were `.tsx`/`.txt`-shaped). Reachability VERIFIED: ORPHANED — not in any sitemap, nothing links to
`/templates/index.html`; the live `/templates` React route (App Router) shadows it for all nav. But it is
git-tracked and publicly FETCHABLE at the explicit URL + crawlable, so it is still a live public claim.*
> "Both `sg.wrap()` and `settlegridMiddleware()` **automatically support** MCP, **MPP, x402**, AP2, Visa TAP,
> UCP, ACP, Mastercard Verifiable Intent, **Circle Nanopayments, and L402** — no protocol-specific code needed.
> SettleGrid detects the protocol from each incoming request and **handles settlement automatically**."
- It asserts automatic support + settlement across MPP (pending-GA), x402/Circle (config-dark), AND lumps
  **detection-only L402** into the same auto-settle set (worse than the in-bounds `docs:706` framing, which
  carves L402 out as a detection adapter).
- **Default fix (simplest):** **DELETE** the orphaned `apps/web/public/templates/index.html` — it is superseded
  by the `/templates` App Router page and serves no live nav. **Alternative:** if kept, reword to the brokered/
  detection coverage framing (separate L402/KYAPay as detection-only; drop "handles settlement automatically"
  for the dark rails) AND add the file to the honest-framing FILE_LIST with a guard. Founder/integrator call;
  deletion is cleanest and removes a recurring-miss liability.

### B9 — `apps/web/src/app/use-cases/page.tsx:149` names x402 + L402 as live cross-platform settlement rails  [LOW·MED]
*Handoff §1 G1-4 Bucket A "Lower-confidence / qualify" surface, left un-demoted.*
> "SettleGrid **handles multi-hop settlement automatically**. … Multiple agent payment protocols including MCP,
> **x402**, AP2, **L402**, and KYAPay **ensure agents can pay each other across platforms**."
- Present-tense capability claim naming config-dark x402 + detection-only L402 as currently enabling
  cross-platform agent payment. **Default fix:** drop x402/L402 from the live "pay each other across platforms"
  enumeration (or reframe to the brokered/detection coverage set), consistent with the rest of the sweep.

### B10 — `apps/web/src/app/api/chat/route.ts:71` x402 unqualified live "Key Feature" in the chat-assistant prompt  [LOW·MED]
> "- x402: facilitator for on-chain USDC settlement (Base network)"
- Flat live capability in the **user-facing chat assistant** system prompt, while the SAME prompt (`:33`)
  qualifies "Stripe MPP (… pending GA)". The assistant can therefore tell users x402 on-chain settlement is a
  current feature, contradicting the demoted `/learn/protocols/x402` prose. **Default fix:** add the same
  in-development/pending qualifier (e.g. "x402: x402 facilitator for on-chain USDC settlement on Base —
  **in development**"). **Confirm first:** whether the standalone x402 *facilitator service* (`/protocols/x402/
  facilitator`, which has its own status badges) is genuinely live independent of proxy settlement — if so,
  scope the line to that service instead of qualifying. Founder/integrator judgment.

---

## 4. LOW / CONSIDER — resolve in the same pass or defer with rationale (not independently blocking)

- **`docs/page.tsx:342`** ("`GET /api/x402/supported` returns the list of supported stablecoins and chains") —
  handoff Bucket A named it, but it is an **API-endpoint reference** and those endpoints exist in code; the
  adjacent "How does on-chain settlement work?" FAQ is already correctly qualified ("When on-chain settlement is
  live…"). **Default: leave** (defensible as API reference) or lightly qualify "(endpoints used by the
  in-development x402 facilitator)". Integrator/founder call.
- **L3 (guard-teeth quality, NON-BLOCKING):** the `T1 — sub-millisecond` `it.each` over-scopes — **9 of its 11
  entries are VACUOUS** for THIS change (those files never carried "sub-millisecond" at HEAD, so the guard
  cannot fire RED pre-fix; only `docs/page.tsx` and `learn/how-mcp-billing-works/page.tsx` actually had it).
  They still work as FORWARD tripwires. **Default:** add a one-line comment marking the other 9 as forward-only
  tripwires, OR trim the `it.each` to the 2 files that had real teeth. Cheap; do it while the test is open.

---

## 5. DEFERRED — route to follow-up, NOT this chunk (unchanged + carried)
- F-data ≥63 dead fork links (`server-catalog.json` vs committed dirs); F4 "1,444+ tools indexed" founder
  reconciliation; tools/page noun nit; billing-verb nit; "9 brokered" counts the dark rails (FROZEN, honest by
  the adapter-coverage definition); "single Redis balance check" architectural prose. All unchanged from the
  round-1/round-2 deferred lists.

---

## 6. DEFECT-CLASS LEDGER — third recurrence + new sub-class (fold into handoff §8)
- **DC-16d THIRD RECURRENCE (B6/B7/B8):** when a status is demoted for a rail, re-scan ALL representations —
  not just named-prose siblings but (a) **cross-cutting / universal-quantifier** claims, (b) **non-`.tsx`/`.txt`
  public assets** (`apps/web/public/**/*.html`), and (c) the **badge-enum vs prose** representation. Each round
  missed a STRUCTURALLY-DIFFERENT representation: R1 = index-vs-detail badge; R2 = a dedicated prose section in a
  long file; R3 = a universal-quantifier FAQ + an orphaned static `.html` + a badge↔prose word mismatch.
- **DC-16g (NEW — universal-quantifier claim):** a claim like "**all/every/each** protocol works automatically /
  **settlement across every protocol**" implicitly asserts the config-dark rails are live WITHOUT naming them,
  so a protocol-NAME-based re-scan misses it. **Cue:** `git grep -niE "(all|every|each)\s+\w*\s*protocols?.*(work|settl|automatic|transparent)|settlement across (every|all)"`
  across both repos + `public/`, and triage whether each universal claim sweeps a dark/pending rail into a live
  assertion.

---

## 7. GATE TO RE-PASS, then re-②
- settlegrid (`apps/web`): `npx tsc --noEmit` → 0; `npm run lint` → 0 err; `npx vitest run` → all pass incl. the
  EXTENDED honest-framing test (the NEW `docs:359` guard proven RED pre-fix → GREEN post-fix; any new MPP-badge
  guard).
- settlegrid-agents: `npx vitest run` → green; `npx tsc --noEmit` → 0 (agents likely UNCHANGED this delta unless
  B10 touches a cross-repo prompt — B10 is settlegrid-only — but re-run to confirm).
- Then **re-enter ②** (high-stakes; ② is the seal gate; ③ post-seal deep audit follows on a clean seal).
  **Before the next ②: confirm `/effort xhigh` is actually active** so the seal-confirmation reviewers run above
  the floor (the recurring DC-16d completeness class is recall-bound — that is where xhigh earns its cost).

---

## 8. COMMIT HYGIENE — apply at SEAL time (unchanged; confirmed by the scope lens this round)
Commit ONLY the claims + regression-test files. **EXCLUDE:**
`docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (own commit — unrelated DB-credential status
update); the **slugify hunks** in `(dashboard)/dashboard/tools/page.tsx` (patch-stage ONLY the `:646` "1,017"→
"servers" hunk via `git add -p`); untracked cross-chunk paths (`.claude/`, `docs/tech-debt/launch-gate-queue.md`,
the v-n3 MFA handoff, `scripts/mfa-delete-smoke.sh`). The `honest-claims-sweep-*.md` docs (handoff, seal-record,
all three recovery records) ARE in-scope. **NEVER** `git add -A` / `git commit -a`. settlegrid-agents is a
separate cohesive commit in its own repo.
