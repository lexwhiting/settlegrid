# ② SEAL-GATING REVIEW (RE-②, round 4) — 🔴 BLOCKED → BUILD RECOVERY — honest-claims-sweep — 2026-06-28

**Outcome:** ② **BLOCKED** (could not seal). Routed to the recovery loop → back to build, then re-②.
This is the FOURTH ② block. The round-1/2/3 deltas (B1–B10, T1–T3, L3) are **applied correctly and
PRESERVED** — this is a focused DELTA on the existing working tree, **NOT a redo**. The block is on a
**NEW contradiction the round-3 B10 fix itself introduced** plus the predicted **fourth recurrence of the
incomplete-sweep class (DC-16d)**.

**Gate is GREEN** (independently re-run from scratch this session — every check ran, evidence below):
settlegrid `tsc 0` / `lint 0` (warnings only) / `vitest 209 files · 4846 passed` (incl. honest-framing);
agents `tsc 0` / `vitest 21 files · 866 passed`. The vitest count moved 4842→**4846** vs the round-3
**pre-build** ②-BLOCK digest — exactly the **+4 new round-3 `it` blocks** (B6 ×2, B7, B9), so the delta is
fully accounted for and the gate genuinely ran on the built code. **All frozen surfaces intact.**

**Review:** 4 decorrelated fresh-context Agent-tool lenses — completeness/SEAM (core-invariant) ·
spec-conformance · guard-teeth/literal-execution · scope-boundary/frozen+commit-hygiene — all
`claude-opus-4-8[1m]`. **Effort report-back: all 4 ran at `high`, NOT the operator-requested `xhigh`** (the
`/effort xhigh` switch did not take effect at spawn time; PATH 1 mixed-effort named-subagent defs do not
exist — no `.claude/agents/` effort-bearing definitions — and the Agent tool inherits session effort & exposes
no effort param). `high` is the policy FLOOR for seal-deciding reviewers, so the review is valid; recorded per
the effort report-back guard. Because the outcome is BLOCKED on concrete, integrator-verified findings (and the
code will change in recovery), a same-pass `xhigh` re-run was **not** spent — **ensure `/effort xhigh` is
actually active before the NEXT re-② (the clean-seal confirmation pass).** Env traps unset; allowlist GREEN
(git/tsc/vitest/lint/npm test); operator chose Agent-tool spawns over a workflow.

Every load-bearing finding below was **live-reproduced first-hand by the integrator** against the built code
(file:line read + `git show HEAD:` diff check + code-path trace) before triage.

---

## 1. WHAT THE BUILD GOT RIGHT — PRESERVE, do NOT redo
- **B6–B10 + L3 all applied** (spec-conformance lens, integrator-confirmed): B6 docs:359 universal-quantifier
  FAQ demoted (+ two teeth-bearing guards, RED@HEAD→GREEN verified); B7 MPP badge `'Ready'→'Pending'` on
  BOTH `protocols/page.tsx:57` + `[slug]/page.tsx:62` (+ guard); B8 `public/templates/index.html` DELETED
  (verified orphaned — `git grep` finds no route/sitemap reference); B9 use-cases:149 dropped x402+L402
  (+ guard); B10 api/chat:71 x402 qualifier ADDED; L3 — the 9 vacuous sub-ms `it.each` entries MARKED
  forward-only (test:520-543). Cross-repo (settlegrid-agents) clean: `x402 (production)`/`Status: production`
  stripped, x402 KEPT in the 9, count "9" preserved, `991→97`, guards in beacon.test.ts + protocol.test.ts.
- **Round-1/2/3 base intact + guard teeth empirically re-verified** (guard-teeth lens, RED@HEAD confirmed via
  `git show HEAD:` for B6/B9 + the G1-1/G1-2/G1-3/G1-4/B1/B2/B3/B4 families; no over-match on kept strings —
  "150ms"/"$50K"/"50K ops"/"95–100%"/"1,017 … servers"/"Next.js 15"/"$0.15" all spared; index `'Lightning
  Labs'` vs detail `'Lightning Labs (Bitcoin)'` correctly distinguished; `\s*` matches the real multi-line
  badge source — no false-pass).
- **Counts verified TRUE, not defects** (integrator first-hand): `server-catalog.json` = **1,017 entries · 22
  distinct categories**; `registry.json` = 97 templates · 6 categories. So `tools/page:110` "1,017 … servers
  across 22 categories" is internally TRUE (the handoff's conditional "22→6" correctly did NOT apply — the
  surface binds to the server catalog). Indexed-server "1,017 servers" surfaces (handbook, learn/page) correctly
  KEPT. USDT fully dropped; `<50ms`/`15-protocol` scans clean.
- **Frozen intact** (scope lens, integrator-confirmed): "9 brokered" count + verb "brokers" UNCHANGED;
  `mcp.json` NOT in the diff (length-11 pin untouched); NO change under `lib/settlement` / `env.ts` /
  `api/proxy` / `api/x402` settle-verify / `api/circle-nano` / auth (no un-darking); stats-bar `:6/:7`
  (95–100% / 50K ops) unchanged; the uncommitted slugify hunks in `(dashboard)/dashboard/tools/page.tsx`
  (~:221, ~:421) intact — only the `:646`→`:643` "1,017 … templates"→"servers" hunk is this chunk's.

---

## 2. BLOCKING FIX — the seal failed on this

### B11 — the round-3 B10 fix CREATED a public self-contradiction: the LIVE x402 *facilitator* mislabeled "not currently available"  [HIGH — BLOCKING]
*A NEW false/contradictory claim INTRODUCED by this sweep — not a pre-existing miss. The B10 spec
EXPLICITLY required "confirm first whether the standalone x402 facilitator service is genuinely live
independent of proxy settlement"; that confirm-first step was skipped, and the blanket demotion conflated the
LIVE facilitator with the config-DARK proxy revenue rail. Flagged INDEPENDENTLY by the completeness AND
spec-conformance lenses.*

**The architectural fact (integrator-traced first-hand — decisive):** the standalone x402 facilitator is a
**separate service, decoupled from the dark proxy revenue rail**:
- `apps/web/src/lib/settlement/x402/settle.ts:64-77` — the facilitator "uses a **DEDICATED, separately-funded
  wallet** (`SETTLEGRID_FACILITATOR_GAS_WALLET_KEY`)", explicitly *distinct* from the proxy/revenue gas wallet
  (`SETTLEGRID_GAS_WALLET_KEY`) "that the revenue rails — the x402 proxy + circle-nano — depend on."
- `apps/web/src/app/api/x402/facilitator/v1/settle/route.ts` does **NOT** call `isX402SettlementEnabled()`.
  That gate (`env.ts:190-191`, requires `SETTLEGRID_GAS_WALLET_KEY` + payee) darkens only the **PROXY** path
  (`api/proxy/[slug]/route.ts:1919` short-circuits). The facilitator runs independently of it.

**The contradiction (live-reproduced in the current tree):**
- This sweep's B10 change **added** "— in development, not currently available" to
  `apps/web/src/app/api/chat/route.ts:71` (HEAD had the unqualified live line). The same facilitator-describing
  demotion was applied to `docs/page.tsx:326`, `learn/protocols/[slug]/page.tsx:114`, and `llms-full.txt:275`.
- But the facilitator's OWN public surfaces — **UNTOUCHED by the sweep** — assert it is LIVE / production:
  - `apps/web/src/app/protocols/x402/facilitator/page.tsx`: `status: 'production'` (`:111`); "SettleGrid runs a
    public x402 facilitator at facilitator.settlegrid.ai. Verify and settle x402 payments on Base mainnet and
    Base Sepolia." (`:20-21`); "the supported list is **a guarantee, not a roadmap**." (`:255`).
  - `apps/web/src/lib/blog-bodies/x402-facilitator-launch.md` — a **PUBLISHED** post (registered
    `blog-posts.ts:672`): "All three [endpoints] required by the x402 v2 facilitator spec are **live** on [day
    one]." on Base mainnet.
- So post-sweep `/docs`, the chat assistant, and the llms-full training surface say the x402 facilitator is "in
  development, not currently available," while the facilitator's landing page + a published launch announcement
  say it's "production / live on day one." **The site now self-contradicts on facilitator liveness — the exact
  DC-16 class this sweep exists to eliminate, newly created by the fix.** The chat assistant will actively tell
  users a shipped, separately-architected product is unavailable.

**Why it's BLOCKING:** authoring new public claims to resolve it (it cannot be silently reverted — the right
wording must distinguish two real things) + it needs a founder/deployment confirmation of the facilitator's
prod funding (the one fact not determinable from code). This is precisely the integrator-must-not-self-author
case.

**✅ FOUNDER CONFIRMED (2026-06-28, via `/build-go`):** the dedicated facilitator gas wallet
(`SETTLEGRID_FACILITATOR_GAS_WALLET_KEY`) **IS funded** → the public x402 facilitator is **LIVE**. The
"confirm first" question is RESOLVED: take the **DEFAULT path** below (REVERT/RESCOPE the B10 over-correction
to distinguish the live facilitator service from the dark proxy revenue rail). Do **NOT** take the
"facilitator NOT funded" override.

**Apply (DEFAULT — the code + the deliberately-published production page/blog say the facilitator is live):**
- **Confirm with the founder:** is the public x402 facilitator (`facilitator.settlegrid.ai`, dedicated
  `SETTLEGRID_FACILITATOR_GAS_WALLET_KEY`) genuinely funded/live in prod? (Default assumption from the evidence:
  YES — it is a shipped product with its own production landing page + launch blog.)
- **If live (default): REVERT/RESCOPE the B10 over-correction.** The honest distinction is:
  - the **standalone facilitator service** (public verify/settle endpoint, own wallet, decoupled from
    `isX402SettlementEnabled`) — **LIVE**; restore truthful framing on `api/chat:71`, and re-examine `docs:326`,
    `[slug]:114`, `llms-full:275` so they describe the facilitator as a live public service;
  - the **proxy x402 *revenue settlement* path** (`sg.wrap`/Smart Proxy settles on the developer's behalf from
    the revenue gas wallet) — **config-DARK**; keep the existing correct demotions (`docs:330/338`, `[slug]:118`
    "native x402 support … in development"). e.g. api/chat:71 → "x402: SettleGrid runs a public x402 facilitator
    (verify + settle on Base) — live; settling x402 payments through the hosted proxy on a developer's behalf is
    in development."
- **If the founder says the facilitator prod wallet is NOT funded (override):** then the facilitator page +
  launch blog are the false surfaces — demote THEM too (status `'production'`→pending; soften "live on day
  one"/"guarantee") so every facilitator surface agrees it is not-yet-live. Either way, **all facilitator
  surfaces must state ONE consistent status.**
- **New regression guard (prove RED→GREEN):** add a `CHAT_ROUTE_TS` (or appropriate file) assertion that pins
  the corrected, non-contradictory facilitator line; and consider a cross-surface consistency note. Pin the
  exact retired phrase.
- **DC-16h re-scan (NEW sub-class — see §6):** before sealing, grep every facilitator-describing surface and
  confirm they agree: `git grep -niE 'x402 facilitator|facilitator.*(live|production|in development|not currently|building)'`
  across `apps/web/src apps/web/public README.md` + the agents repo; triage each as "facilitator service" vs
  "proxy revenue settlement" and make the status consistent within each category.

---

## 3. SHOULD-FIX — fold into the SAME delta (the x402/claims surfaces are already being reopened)

### B12 — `docs/page.tsx:706` still claims "automatically supports … handles settlement automatically" for config-dark x402 + Circle  [MED]
*FOURTH DC-16d recurrence — converged across the completeness AND spec-conformance lenses. B8 DELETED the
orphaned `templates/index.html` because it claimed auto-support + auto-settlement across the dark rails; the
**live, reachable** `/docs` FAQ twin carries the VERBATIM sentence and survived.*
- `apps/web/src/app/docs/page.tsx:706` (FAQ "Do these templates work with all the protocols…"): "…the sg.wrap()
  pattern … **automatically supports** … MCP, **x402 (Coinbase)**, Stripe MPP …, **Circle Nanopayments**, with
  detection adapters for L402 and KYAPay … SettleGrid detects the protocol from each incoming request and
  **handles settlement automatically**."
- The trailing sentence is **byte-identical** to the deleted `templates/index.html:159` sentence
  (integrator-confirmed via `git show HEAD:`). The L402/KYAPay carve-out does NOT cure **x402 + Circle**
  (config-dark) or the stronger-than-"brokers" verb "handles settlement automatically". Same defect class as the
  previously-BLOCKING `:359`/B6; the round-3 DC-16g grep structurally can't catch it (it says "each incoming
  **request**", not "each protocol", and has no "settlement across every/all").
- **Apply:** reframe to the FROZEN brokered/detection coverage wording (drop "handles settlement automatically"
  for the dark rails, or carve x402/Circle/MPP into the in-development/pending framing the rest of the sweep
  uses). Add a `DOCS_PAGE_TSX` guard pinning the retired phrase.

### B13 — `compare/nevermined/page.tsx:399` SettleGrid CTA names x402 as a live billing rail  [LOW-MED]
*Un-enumerated surface (handoff bounded out only the Nevermined-COLUMN `:131/:144`, NOT this self-claim CTA).*
- `:399` "**Start with SettleGrid** … Two lines of code to **start billing any MCP, x402, or AP2 tool**. No
  credit card required." + `:52` SEO keyword "**x402 settlement layer**". Present-tense x402 live-billing
  self-claim (proxy path = dark). **Apply:** drop x402 from the CTA enumeration (or qualify), consistent with the
  rest of the sweep. Confirm the keyword line is a deliberate SEO term vs a claim (founder call; default soften).

### B14 — `use-cases/page.tsx:149` kept detection-only KYAPay in the live "pay each other across platforms" claim  [LOW-MED]
*Converged completeness + spec-conformance. B9 dropped x402 (dark) + L402 (detection-only) but KEPT KYAPay —
also a **detection-only** adapter ("detection adapters for 2 more: L402 … and KYAPay", api/chat:33). Inconsistent
application of the sweep's own rule.*
- `:149` "Multiple agent payment protocols including MCP, AP2, and **KYAPay** ensure agents can pay each other
  across platforms." **Apply:** drop KYAPay too (leaving MCP+AP2, both live in the 9), or reframe to the
  brokered/detection coverage set. Update the B9 guard if the retired-phrase pin needs adjusting.

### B15 — `faq/page.tsx:56` noun fixed but the workflow verb re-implies all 1,017 indexed servers are billing-pre-wired  [LOW-MED]
*Softer DC-16a residue. The handoff §1 G1-2 default for this exact surface was "→ 97"; the build kept "1,017
servers" (internally fine) but left the forkable-TEMPLATE workflow verb.*
- `:56` "**Fork one of our 1,017 open-source MCP servers, add your API key, deploy** … Your tool automatically
  appears in the Showcase." Only 97 of the 1,017 indexed servers are billing-pre-wired templates; "add your API
  key" presumes pre-wiring. Sibling surfaces say "Fork **on GitHub, add SettleGrid billing**" (`servers/page:99`,
  `tools:110`). **Apply:** align faq:56 to the sibling "fork on GitHub, add SettleGrid billing" framing (or bind
  the forkable claim to 97 per the handoff default).

---

## 4. LOW / CONSIDER — resolve in the same pass or defer with rationale (not independently blocking)
- **`platform/platform-agents.tsx:58`** ("MCP, x402, AP2, MPP, Visa TAP, and 10 more. Your tool is reachable by
  any AI agent regardless of which payment protocol it speaks") — present-tense reachability naming x402/MPP.
  This is the detection/coverage framing (the proxy DETECTS the protocol — true) and the file is test-pinned
  (`toContain('14')`). **Default: leave** (defensible as coverage, like the frozen "brokers 9"); confirm it isn't
  read as live settlement. Integrator/founder call.
- **Testnet badge color == Production amber** (`protocols/page.tsx:207` + `[slug]:636` map `Testnet` to the same
  `amber-500/10 text-amber-400` as `Production`) — the demoted x402/Circle/L402/DRAIN badges render in "live
  amber". **Pre-existing** (this is round-2's T4, already deferred as out-of-scope styling). Carry as deferred;
  not introduced this chunk.
- **B7 `not-Ready` MPP guard is forward-only, not disclosed as such** (guard-teeth lens, LOW): the MPP badge was
  `'Production'` at HEAD (never `'Ready'` in any committed tree), so the `not-Ready` guard has no git-reachable
  RED — but the sibling B3 `not-Production` guard carries the real HEAD teeth, so MPP coverage is intact.
  **Optional:** add a one-line comment marking the B7 `not-Ready` assertion forward-only (mirror the T1
  disclosure). Cheap; do it while the test is open.
- **B6/B9 exact-phrase guards are narrow** (guard-teeth lens, LOW): they pin the literal retired sentence, so a
  reworded/reordered reintroduction would slip past. Deliberate tradeoff (avoids over-matching education prose);
  accept, or broaden slightly if cheap. Non-blocking.

---

## 5. DEFERRED — route to follow-up, NOT this chunk (unchanged + carried)
- agents `beacon/prompts.ts:18` "1,444+ tools indexed" (founder reconciliation §9.1 — conflicts with the 1,017
  catalog); F-data ≥63 dead fork links; tools/page "Browse templates →" CTA noun nit (→ /servers); the "17
  quickstart guides / 17 template files" internal tension (`tools:648`/`docs:690`); "9 brokered" counts the dark
  rails (FROZEN, honest by the adapter-coverage definition); "single Redis balance check" architectural prose.
  All unchanged from prior rounds' deferred lists.

---

## 6. DEFECT-CLASS LEDGER — fourth recurrence + new sub-class (fold into handoff §8)
- **DC-16d FOURTH RECURRENCE (B12):** when a status is demoted/removed for a rail, re-scan ALL representations —
  including the **byte-identical twin on a different surface** (the deleted `index.html` sentence survived
  verbatim at `docs:706`). R1 = index-vs-detail badge; R2 = a prose section in a long file; R3 =
  universal-quantifier FAQ + orphaned `.html` + badge↔prose word mismatch; R4 = **a deleted claim's surviving
  identical twin in a live FAQ**. Cue: when DELETING a claim, `git grep` the distinctive sentence and demote/
  delete EVERY copy, not just the named asset.
- **DC-16h (NEW — demotion-induced contradiction / over-correction):** demoting a claim can CREATE a new
  contradiction when two architecturally-distinct primitives share a name (the live x402 **facilitator service**
  vs the dark x402 **proxy revenue settlement**). A blanket name-based demotion mislabels the live one. **Cue:**
  before demoting "x402/Circle/L402/MPP is in development", trace whether MORE THAN ONE code path implements that
  name, and confirm each surface refers to the DARK one; reconcile the demoted surfaces against any OTHER surface
  (landing page, launch blog, status badge) that still asserts the sibling primitive is live. The "confirm first"
  clause exists for exactly this — do not skip it.

---

## 7. GATE TO RE-PASS, then re-②
- settlegrid (`apps/web`): `npx tsc --noEmit` → 0; `npm run lint` → 0 err; `npx vitest run` → all pass incl. the
  EXTENDED honest-framing test (the NEW B11 facilitator guard + any B12 `docs:706` guard proven RED→GREEN).
- settlegrid-agents: `npx vitest run` → green; `npx tsc --noEmit` → 0 (likely UNCHANGED this delta unless B11's
  facilitator reconciliation touches a cross-repo prompt — check `agents/beacon/prompts.ts` / `protocol/prompts.ts`
  for any facilitator "in development" line that needs the same rescope).
- Then **re-enter ②** (high-stakes; ② is the seal gate; ③ post-seal deep audit follows on a clean seal).
  **Before the next ②: confirm `/effort xhigh` is actually active** (the recurring DC-16 completeness class is
  recall-bound — that is where xhigh earns its cost).

---

## 8. COMMIT HYGIENE — apply at SEAL time (unchanged; re-confirmed by the scope lens this round)
Commit ONLY the claims + regression-test files + the `honest-claims-sweep-*.md` docs (handoff, seal-record, all
FOUR recovery rounds). **EXCLUDE:** `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (own commit —
unrelated DB-credential status update); the **slugify hunks** in `(dashboard)/dashboard/tools/page.tsx` (patch-
stage ONLY the `:643` "1,017"→"servers" hunk via `git add -p`); untracked cross-chunk paths (`.claude/`,
`docs/tech-debt/launch-gate-queue.md`, the v-n3 MFA handoff, `scripts/mfa-delete-smoke.sh`). **NEVER**
`git add -A` / `git commit -a`. settlegrid-agents is a separate cohesive commit in its own repo.
