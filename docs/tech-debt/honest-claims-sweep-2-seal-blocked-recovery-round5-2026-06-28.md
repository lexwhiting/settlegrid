# ② SEAL-GATING REVIEW (RE-②, round 5) — 🔴 BLOCKED → BUILD RECOVERY — honest-claims-sweep — 2026-06-28

**Outcome:** ② **BLOCKED** (could not seal). Routed to the recovery loop → back to build, then re-②.
This is the FIFTH ② block. The round-1/2/3/4 deltas (B1–B15, T1–T3, L3) are **applied correctly and
PRESERVED** — this is a focused DELTA on the existing working tree, **NOT a redo**. The block is the
**FIFTH recurrence of the incomplete-sweep class (DC-16d/DC-16h)**: the round-4 B11 fix injected a NEW
"x402 facilitator is LIVE" claim into a docs FAQ cluster the earlier rounds had **uniformly demoted to
"in development / not currently available"**, and did not reconcile the surrounding sibling lines — so
`/docs` now self-contradicts on whether on-chain x402 settlement is available.

**Gate is GREEN** (independently re-run from scratch this session — every check ran, evidence below):
settlegrid `tsc 0` / `lint 0` (warnings only) / `vitest 209 files · 4853 passed` (incl. honest-framing);
agents `tsc 0` / `vitest 21 files · 866 passed`. The vitest count moved 4846→**4853** vs the round-4
②-BLOCK digest — exactly the **+7 new round-4 `it` blocks** (B11 ×2, B12 ×2, B13, B14, B15), so the delta
is fully accounted for and the gate genuinely ran on the built code. **All frozen surfaces intact.**

**Review:** 4 decorrelated fresh-context Agent-tool lenses — completeness/SEAM (core-invariant) ·
spec-conformance · guard-teeth/literal-execution · scope-boundary/frozen+commit-hygiene — all
`claude-opus-4-8[1m]`. **Effort report-back: all 4 ran at `high`, NOT the operator-selected `xhigh`** (the
`/effort xhigh` switch did not propagate to the Agent-tool spawns — they inherit session effort and expose
no effort param; PATH 1 mixed-effort named-subagent defs do not exist — no `.claude/agents/` directory).
`high` is the policy FLOOR for seal-deciding reviewers, so the review is valid; recorded per the effort
report-back guard. **This is the 4th consecutive round the `/effort xhigh` request has not taken effect via
the Agent-tool path** — see §7 for the durable recommendation. Because the outcome is BLOCKED on concrete,
integrator-reproduced findings (and the code will change in recovery), a same-pass `xhigh` re-run was **not**
spent. Env traps unset; allowlist GREEN (git/tsc/vitest/lint); operator chose Agent-tool spawns over a
workflow (allowlist-GREEN moots the workflow loud-pause edge).

Every load-bearing finding below was **live-reproduced first-hand by the integrator** against the built code
(file:line read + `git show HEAD:` diff check + code-path trace) before triage. The integrator's own
foreground completeness grep independently surfaced the BLOCKING cluster; the completeness lens confirmed and
broadened it; the scope lens independently converged on the badge mismatch.

---

## 1. WHAT THE BUILD GOT RIGHT — PRESERVE, do NOT redo
- **B11–B15 + B7 all applied correctly** (spec-conformance lens, integrator-confirmed first-hand):
  - **B11 DEFAULT path taken correctly.** `api/chat/route.ts:71`, `docs/page.tsx:326`,
    `learn/protocols/[slug]/page.tsx:114`, `public/llms-full.txt:275` all distinguish the LIVE standalone
    facilitator from the in-development proxy/metering layer. The proxy-path demotions are KEPT
    (`docs:330/338`, `[slug]:118`). The "facilitator NOT funded" OVERRIDE path was correctly NOT taken —
    `protocols/x402/facilitator/page.tsx` (`status:'production'`) + `lib/blog-bodies/x402-facilitator-launch.md`
    are UNCHANGED vs HEAD.
  - **B11 truth premise INDEPENDENTLY VERIFIED true** (spec lens, traced first-hand): the facilitator routes
    `api/x402/facilitator/v1/{settle,verify,supported}/route.ts` do **NOT** call `isX402SettlementEnabled()`;
    `lib/settlement/x402/settle.ts:72-83` uses the dedicated `SETTLEGRID_FACILITATOR_GAS_WALLET_KEY`;
    `env.ts:190` `isX402SettlementEnabled` gates ONLY the proxy (`api/proxy/[slug]/route.ts:1919`). With the
    founder-confirmed funded wallet, the facilitator "live" claim is architecturally TRUE.
  - **B12** `docs:706` verbatim twin reframed to brokered framing (+ DOCS_PAGE_TSX guard, git-reachable RED
    from HEAD — strongest teeth in the suite). **B13** `compare/nevermined:399` dropped x402 from the CTA.
    **B14** `use-cases:149` dropped KYAPay. **B15** `faq:56` aligned to "fork on GitHub, add SettleGrid
    billing". **B7** not-Ready MPP guard marked forward-only.
- **All 7 round-4 guards have REAL TEETH** (guard-teeth lens, empirically harness-verified): each fires RED on
  the reconstructed round-3 pre-fix string and GREEN on the current string; correct file-scoping; no over-match
  on kept strings ("9 brokered", "1,017 … servers", facilitator "live", "150ms", "$50K", "95–100%"). 93/93
  honest-framing tests green.
- **Frozen intact** (scope lens, integrator-confirmed): "9 brokered" count + verb "brokers" UNCHANGED (docs:706
  even strengthened handles→brokers; stats-bar adds a `"9"` entry); `mcp.json` NOT in diff; NO change under
  `lib/settlement`/`env.ts`/`api/proxy`/`api/x402`/`api/circle-nano`/auth (no un-darking); stats-bar 95–100% /
  50K ops unchanged; facilitator surfaces untouched; the slugify hunks in `(dashboard)/dashboard/tools/page.tsx`
  (~:221, ~:421) intact — only the `:643` hunk is this chunk's.
- **Cross-repo (settlegrid-agents) CLEAN** (completeness lens): `beacon/prompts.ts` + `protocol/prompts.ts`
  dropped "(production)" / "Status: production", replaced with "Adapter wired into the Smart Proxy; on-chain
  settlement is config-gated" (true for the dark proxy path); they never mention the standalone facilitator, so
  no contradiction with the live-facilitator framing. No facilitator status line needs the rescope (§7 of the
  round-4 doc anticipated this).

---

## 2. BLOCKING FIX — the seal failed on this

### B16 — the docs `x402 & Crypto Settlement` FAQ cluster self-contradicts: B11 made `:326` say the facilitator is LIVE, but five sibling lines still say x402 on-chain settlement is "not currently available"  [HIGH — BLOCKING]
*FIFTH recurrence of the incomplete-sweep class. The round-4 B11 fix reframed ONLY `docs:326` (+ chat:71,
[slug]:114, llms-full:275) to assert the live facilitator, but left every OTHER x402-settlement line on the
same `/docs` page asserting the categorical opposite. Flagged INDEPENDENTLY by the integrator's foreground grep
AND the completeness/SEAM lens. Live-reproduced in the current tree.*

**The contradiction (all in `apps/web/src/app/docs/page.tsx`, current tree):**
- `:326` ("What is x402?"): "SettleGrid runs a public x402 facilitator (**verify + settle on Base mainnet** and
  Base Sepolia) as a standalone service; the metering, budgets, and analytics layer … is in development."
  → **asserts live on-chain settle on Base MAINNET.**
- `:342` ("What x402 API endpoints are available?", UNCHANGED this sweep): "POST /api/x402/settle **processes the
  settlement** … These are used internally by the SDK and **can also be called directly**." → asserts a live
  settle endpoint (true — the facilitator routes are un-gated).
- BUT the sibling lines say the opposite, **categorically, with no facilitator-vs-proxy scoping**:
  - `:330` ("What chains are supported?"): "**On-chain crypto settlement (USDC via the x402 protocol) is in
    development and not currently available.** When live, the platform maintains a unified fiat + crypto ledger…"
  - `:334` ("Do I need a crypto wallet?"): "Crypto settlement via x402 is a planned additional capability
    **(in development)**…"
  - `:338` ("How does on-chain settlement work?"): "**When on-chain settlement is live**, SettleGrid verifies the
    payment, meters the operation, and credits the developer…"
  - `:359` (the round-3 B6-demoted universal-quantifier FAQ): "x402 and other on-chain rails **are in development
    and not currently available.**"
  - `:211` (general "what payment methods" FAQ, different section): "Crypto payments via the x402 protocol (USDC)
    **are in development and not currently available.**"
- The facilitator's literal function ("verify + **settle** on Base mainnet") **IS** "on-chain crypto settlement
  (USDC via the x402 protocol)" — verified live. So `:330`'s categorical denial flatly contradicts `:326`/`:342`
  in the same accordion. A reader expanding two adjacent FAQs sees "we run a facilitator that settles on Base
  mainnet" next to "on-chain crypto settlement via x402 is not currently available." **This is the exact DC-16
  self-contradiction class the sweep exists to eliminate — newly created by the B11 fix.**

**Why it's BLOCKING:** it is a live, reader-visible self-contradiction on the highest-traffic doc page + the
llms-full training surface; resolving it requires authoring NEW public claim wording (the demoted siblings must
be re-scoped to the dark proxy/platform-revenue path, or the facilitator distinction made legible on each) →
the integrator-must-not-self-author case.

**⚠ Founder pre-check before reconciling (reachability, NOT just funding):** the round-4 founder confirmation
(via `/build-go`) was specifically that the facilitator **gas wallet is funded**. But in-repo signals say the
public facilitator may not yet be **reachable**: `blog-posts.ts:664` keeps the launch post `published:false`
"until the founder has provisioned DNS for `facilitator.settlegrid.ai` [and] smoke-tested the three /v1
endpoints from outside the SettleGrid network," and `api/x402/facilitator/v1/supported/route.ts` lists the same
DNS provisioning as "Founder action required before this route serves real traffic." Funded-wallet ≠
DNS-provisioned-and-serving. **Confirm with the founder which is true**, because it picks the resolution:
- **Resolution A (DEFAULT — facilitator IS reachable/live in prod):** keep `:326` and re-scope the demoted
  siblings to the proxy/platform-revenue path so they stop reading as categorical denials of the live facilitator.
  e.g. `:330` → "Settling **your tool's revenue** on-chain (USDC via x402) through the hosted proxy is in
  development; the standalone facilitator that verifies + settles x402 on Base is live." Apply the same scoping to
  `:334`, `:338`, `:359`, `:211`, and (re-examine) the `chat:71`/`[slug]:114`/`llms-full:275` neighbours for the
  same sibling gap.
- **Resolution B (facilitator NOT yet reachable — only wallet-funded):** then `:326`/`:342`/`chat:71`/
  `[slug]:114`/`llms-full:275`'s "live" framing is premature — re-demote them to match the siblings (and demote
  the facilitator landing page `status:'production'` + the `published:false` blog stays draft). Every x402
  surface then agrees it is not-yet-live.
- **Either way: reconcile the WHOLE x402 claim cluster to ONE consistent status, not a named subset.** Before
  sealing, the build MUST grep `docs/page.tsx` exhaustively, not a hand-listed set:
  `git grep -nE 'x402|on-chain|crypto settlement' -- apps/web/src/app/docs/page.tsx` and reconcile EVERY hit, plus
  re-run the cross-surface scan `git grep -niE 'in development|not currently available|when .{0,30}live|planned additional capability'`
  over `apps/web/src apps/web/public README.md` and triage each x402 hit as facilitator-service (live) vs
  proxy/platform-revenue (dark).
- **New regression guard (prove RED→GREEN):** add a `DOCS_PAGE_TSX` assertion that the page does not carry a
  categorical "on-chain crypto settlement (USDC via the x402 protocol) is … not currently available" while also
  asserting the live facilitator — pin the retired categorical phrase so the contradiction cannot silently
  reappear. Mark forward-only if it has no git-reachable RED.

---

## 3. SHOULD-FIX — fold into the SAME delta (the x402 cluster is already being reopened)

### B17 — x402 status badge demoted to `'Testnet'` while the facilitator page says `'production'` and the entry's own prose says live mainnet  [MED]
*Converged completeness + scope lenses. Cross-surface + within-entry mismatch on the x402 liveness/network
primitive.*
- `apps/web/src/app/learn/protocols/page.tsx:67` — `status: 'Testnet'` (was `'Production'` at HEAD — demoted this
  sweep). `apps/web/src/app/learn/protocols/[slug]/page.tsx:112` — `status: 'Testnet'`, yet its own overview
  `:114` says "SettleGrid runs a public x402 facilitator (verify + settle on Base) … standalone service" and
  `paymentType: 'on-chain USDC (Base)'`.
- `apps/web/src/app/protocols/x402/facilitator/page.tsx:111` — `status: 'production'` (UNTOUCHED), `:108` "Base
  mainnet", `:253` "Base mainnet … on day one".
- `'Testnet'` both under-claims the live Base-**mainnet** facilitator and disagrees with the facilitator page's
  `'production'`. **Apply (founder call, tied to B16's Resolution A/B):** reconcile to ONE x402 status. Under
  Resolution A the badge likely should reflect "facilitator live, platform settlement pending" (not bare
  `'Testnet'`); under Resolution B `'Testnet'`/pending is fine but the facilitator page must move too. Update/add
  the badge guard to pin the chosen value.

### B18 — `[slug]:118` integration field says x402 "not currently available" then lists three LIVE facilitator endpoints  [MED]
- `apps/web/src/app/learn/protocols/[slug]/page.tsx:118`: "SettleGrid's native x402 support **is in development and
  not currently available.** When live, … Three API endpoints handle the flow: /api/x402/verify, /api/x402/settle,
  and /api/x402/supported." The three endpoints are the un-gated, LIVE facilitator routes, so "not currently
  available" sits one sentence from naming live endpoints. **Apply:** scope "native x402 support" explicitly to the
  proxy/platform path, or note the endpoints are the live facilitator (consistent with B16's resolution).

---

## 4. LOW / CONSIDER — resolve in the same pass or defer with rationale (not independently blocking)
- **`llms-full.txt:275` newly names the vanity hostname `facilitator.settlegrid.ai`** (HEAD did not). If the
  founder pre-check (B16) finds DNS is NOT yet provisioned, soften "at facilitator.settlegrid.ai" or note the
  endpoints are reachable at `settlegrid.ai/api/x402/facilitator/v1/*`. Mitigant: the untouched, deliberately
  shipped landing page already asserts the same hostname. Founder/reachability call.
- **Guard forward-only disclosure** (guard-teeth lens, LOW): B11#1 (`chat:71` retired-phrase negative), B14, and
  B15 negatives pin **round-3-built-tree** strings with **no git-reachable RED from any committed tree** (their RED
  exists only in the uncommitted round-3 build). Their sibling positive/HEAD-anchored guards carry the real teeth,
  so coverage holds — but add a one-line "RED reachable only on the uncommitted round-3 build" comment next to
  these three (mirror the existing T1/B7 forward-only disclosures). Cheap; do it while the test is open. (B12, B13
  are git-reachable from HEAD — bulletproof, no disclosure needed.)
- **`compare/nevermined:52` `'x402 settlement layer'` SEO keyword KEPT** (spec §3 default was "soften"; build kept
  it with the rationale that the live facilitator settles x402). Defensible post-B11 + within the spec's "founder
  call" latitude. **Default: accept**; confirm it's a deliberate SEO term.
- **`platform/platform-agents.tsx:58`** present-tense x402 reachability ("reachable by any AI agent regardless of
  which payment protocol it speaks") while the proxy x402 path is dark — pre-existing under-demotion, test-pinned
  (`toContain('14')`), defensible as adapter-coverage framing. **Default: leave** (handoff §4 already so-marked).
- **`use-cases:149`** "handles multi-hop settlement automatically … automatic revenue splits" KEPT (KYAPay dropped
  per B14) — multi-hop = the fiat session/budget primitive, likely defensible. **Default: leave**; confirm it's
  fiat, not a crypto-settlement claim.
- **Grammar nit `[slug]:114`** "…layer SettleGrid adds on top **is** in development" (missing the em-dash/comma the
  cleaner `docs:326` sibling uses). Cosmetic; fix if touching the line for B16/B17.

---

## 5. DEFERRED — route to follow-up, NOT this chunk (unchanged + carried)
- Testnet badge color == Production amber (`protocols:207` + `[slug]:636`) — pre-existing round-2 T4 styling,
  out-of-scope. agents `beacon/prompts.ts` "1,444+ tools indexed" (founder reconciliation §9.1). F-data dead fork
  links; "17 quickstart guides / 17 template files" internal tension; "9 brokered" counts the dark rails (FROZEN,
  honest by the adapter-coverage definition); "single Redis balance check" prose. All unchanged from prior rounds'
  deferred lists.

---

## 6. DEFECT-CLASS LEDGER — fifth recurrence (fold into handoff §8)
- **DC-16d/DC-16h FIFTH RECURRENCE (B16):** a status reframe (here: introducing a "live facilitator" claim) must
  re-scan and reconcile ALL sibling claims on the SAME surface — not just the named line. R1 = index-vs-detail
  badge; R2 = a prose section in a long file; R3 = universal-quantifier FAQ + orphaned `.html` + badge↔prose;
  R4 = a deleted claim's surviving identical twin in a live FAQ; R5 = **a newly-introduced LIVENESS claim left
  un-reconciled against its uniformly-demoted FAQ siblings on the same page.** Cue: when you ADD a "live" claim
  for a primitive the sweep previously demoted everywhere, grep the WHOLE surface for every other reference to
  that primitive and reconcile each — a "live" claim and a categorical "not available" claim on the same page is
  the same self-contradiction class, regardless of direction. **The recurring root is hand-listing a subset of
  surfaces instead of grepping the primitive exhaustively before declaring the sweep complete.**

---

## 7. GATE TO RE-PASS, then re-②
- settlegrid (`apps/web`): `npx tsc --noEmit` → 0; `npm run lint` → 0 err; `npx vitest run` → all pass incl. the
  EXTENDED honest-framing test (the NEW B16 docs-cluster reconciliation guard + any B17 badge guard proven
  RED→GREEN).
- settlegrid-agents: `npx vitest run` → green; `npx tsc --noEmit` → 0 (likely UNCHANGED this delta — the agents
  prompts are already reconciled).
- Then **re-enter ②** (high-stakes; ② is the seal gate; ③ post-seal deep audit follows on a clean seal).
- **Effort — durable recommendation (the 4th-round-recurring problem):** `/effort xhigh` selected via the option
  prompt has NOT propagated to the Agent-tool spawns in rounds 2/3/4/5 (they inherit session effort and expose no
  effort param). To actually realize a higher-recall pass on the next re-②, either (a) **stand up PATH-1
  effort-bearing reviewer definitions** under `.claude/agents/` (each with `effort: xhigh`/`max` +
  `model: claude-opus-4-8` frontmatter) **before** the phase — a freshly-written def may not load until session
  reload, so this is an operator/setup step, not a mid-run one; or (b) accept `high` (the floor) and lean on the
  integrator's **foreground completeness grep**, which is what independently caught the B16 cluster this round at
  session effort. Given the recall-bound nature of this exact defect class, (a) is the durable fix; (b) has
  empirically been sufficient so far because the foreground grep + 4 high lenses keep converging on the blocker.

---

## 8. COMMIT HYGIENE — apply at SEAL time (unchanged; re-confirmed by the scope lens this round)
Commit ONLY the claims + regression-test files + the `honest-claims-sweep-*.md` docs (handoff, seal-record, all
FIVE recovery rounds). **EXCLUDE:** `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (own commit —
unrelated DB-credential status update); the **slugify hunks** in `(dashboard)/dashboard/tools/page.tsx` (patch-
stage ONLY the `:643` "1,017"→"servers" hunk via `git add -p` — the three hunks at ~221/~421/~643 are cleanly
isolable, confirmed); untracked cross-chunk paths (`.claude/`, `docs/tech-debt/launch-gate-queue.md`, the v-n3
MFA handoff, `scripts/mfa-delete-smoke.sh`). **NEVER** `git add -A` / `git commit -a`. settlegrid-agents is a
separate cohesive commit in its own repo.
