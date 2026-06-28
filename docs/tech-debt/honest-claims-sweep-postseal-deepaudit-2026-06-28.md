# ③ POST-SEAL DEEP AUDIT — honest-claims-sweep — 2026-06-28

**Verdict: RE-CERTIFIED (HARDENED).** The shipped honest-claims-sweep deliverable
(commit `383436d7`, G1-1…G1-5) is correct and to-spec on the integrated whole; one
sustained guard-efficacy defect in its own regression test was fixed-folded and
live-reproduced. Several **out-of-bucket, pre-existing** overclaims were surfaced and
routed (they do not impugn this chunk's scope, mirroring the ② F2–F6 / DC-18 handling).

Scope of this phase = the INTEGRATED WHOLE at `383436d7` + the cross-repo
`settlegrid-agents` working tree, distinct from the ② diff-scoped seal review.

---

## 0. MECHANICAL PRE-FLIGHT (re-run from scratch this session)

- **Gate GREEN both repos:** apps/web `tsc 0` / `lint 0` (2 pre-existing warns) / `vitest 209f·4858p` (incl honest-framing); settlegrid-agents `tsc 0` / `vitest 21f·866p`.
- **Count invariants re-derived:** `server-catalog.json` = **1017 entries / 22 distinct categories**; `registry.json` `totalTemplates` = **97 / 6 categories**. → `tools/page.tsx:110` "1,017 … servers across **22 categories**" is TRUE (servers→catalog→22 cats; the handoff's "→6" applied to the old *templates*/registry framing). All `1,017` surfaces carry the SERVERS noun; the forkable-template noun never pairs with 1,017.
- **"15 protocols"** fully retired (only test guards + `15-protocol-claim.md` citations remain). **"<50ms"** fully removed (residual `50ms`/`150ms` hits are telemetry field names `p50Ms`/`p95Ms`, a histogram-bucket comment, CSS `animation-delay`, "50K" volume — no marketing latency claim). **"USDT"** appears ONLY inside the retired-phrase test guard (settlement is USDC-only).
- **Frozen surfaces UNTOUCHED** by `383436d7`: `lib/settlement`, `lib/env.ts`, `api/proxy`, `api/x402`, `api/circle-nano`, `/auth/`, `.well-known/mpp.json`, `.well-known/mcp.json` (protocols[] len 11 intact), the facilitator page, the `isX402SettlementEnabled`/`isCircleNanoKernelEnabled` gates.
- **Commit hygiene CLEAN:** the SECURITY-INCIDENT doc, `.claude/`, `launch-gate-queue.md`, the mfa handoff/smoke-script, and the slugify hunks did NOT leak in; the honest-claims-sweep `*.md` docs + the regression test were correctly included; the uncommitted slugify delta in `(dashboard)/dashboard/tools/page.tsx` survives unclobbered (the committed hunk there is solely the `:646` servers line).
- **Facilitator liveness EMPIRICALLY CONFIRMED:** `bash scripts/x402-facilitator-smoke.sh` → **3/3 GREEN** (`/v1/supported` 200 + day-one Base allowlist [eip155:8453, eip155:84532], no `payment-identifier` overclaim; `/v1/verify` rejects malformed; `/v1/settle` rejects unsupported network with `UNSUPPORTED_NETWORK`). **Resolution A is vindicated by live infra, not just operator assertion** — this permanently closes the rounds-4/5/6 reachability question (DC-15 drift).

---

## 1. ORCHESTRATION / POLICY

- Fan-out via **Agent-tool spawns** (operator-chosen over a workflow; allowlist-GREEN moots the workflow loud-pause). 5 decorrelated lenses + a collective-miss critic, all `claude-opus-4-8[1m]`, all **@ HIGH** (the policy floor — Path-1 effort-bearing defs absent [no `.claude/agents`], `/effort xhigh` not realized; operator chose "accept high"; each reviewer reported its model+effort per the report-back guard). Env traps unset (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL); no model pin → Opus 4.8.
- Lenses: (1) SEAM/cross-surface coherence · (2) LITERAL-EXECUTION/guard-teeth · (3) COMPLETENESS/crypto-demotion (DC-16) · (4) COUNT-NOUN + FROZEN-SCOPE + COMMIT-HYGIENE · (5) CROSS-REPO agents (literal-execution-as-agent). Collective-miss critic ran @ high (max bump not taken — Path-1 absent, no operator mid-run switch; noted, run carried to 100% per the no-stall rule).

---

## 2. THE ONE FIX-FOLDED FINDING (in-scope; closed this phase)

**[MED·HIGH] DC-16c recurrence — `honest-framing-regression.test.ts:306-310` platform-agents "14-vs-15" guard was EMPIRICALLY TOOTHLESS.**
The guard's purpose is to prevent a 14→15 protocol-count regression on the visible tagline (`platform-agents.tsx:39` "14 agent payment protocols tracked"). But:
- Negative `not.toMatch(/\b15 payment protocols\b/)` missed the live tagline's **"agent"-infixed** form ("15 **agent** payment protocols").
- Positive `toContain('14')` was **vacuous** — satisfied by the unrelated code comment `// … = 14 total` (`platform-agents.tsx:6`), independent of the tagline.
- **Proven:** flipping the tagline 14→15 left all 98 honest-framing tests GREEN.

**Fix (live-reproduced, DC-17 inverse-Edit discipline):** tightened the negative to `/\b15 (?:agent )?payment protocols\b/` and replaced the vacuous positive with `toMatch(/\b14 agent payment protocols tracked\b/)` (pins the visible tagline phrase). Reproduction: with the fix + injected "15 agent payment protocols tracked" → the block goes **RED**; after inverse-reverting the injection → **98/98 GREEN**; full apps/web suite **209f·4858p GREEN**; working tree clean (only the test file modified; `platform-agents.tsx` byte-identical to HEAD).

All OTHER load-bearing guards proved real teeth (RED-on-inject → GREEN-on-revert): B19 `extends x402 with credit-based budgets…` (:883), `1,017…templates` (:445), stats-bar `value:"15"` (:385), `<50ms` (:430), crypto `Crypto payments are supported via the x402 protocol` (:475); plus the cross-repo agents negatives (`beacon.test.ts:178`, `protocol.test.ts:285-286`) — correctly homed in prompt-importing files, real teeth.

---

## 3. OUT-OF-BUCKET / PRE-EXISTING FINDINGS (do NOT affect this seal — ROUTED)

These are pre-existing, not introduced by `383436d7`, and outside the G1-1…G1-5 buckets.
Disposition mirrors the ② F2–F6 handling: seal stands, route to the follow-up / operator.

1. **[HIGH·HIGH] Multi-hop ATOMIC settlement is claims-vs-runtime FALSE on ~12 surfaces (NEW class DC-18b).**
   "Multi-hop atomic settlement / everyone gets paid or no one does / commits or rolls back as one unit / no partial payments" is asserted live, but the disbursement+rollback engine is **unreachable**: `createSession` hardcodes `settlementMode:'immediate'` (`sessions.ts:136`), `/api/sessions` POST schema does not accept `settlementMode` (`route.ts:14-20`), the atomic disbursement-map lives only in the dead `'deferred'|'atomic'` branch (`sessions.ts:580-660`), and `processSettlementBatch`/`rollbackSettlementBatch` have **zero runtime callers** (referenced only by the export barrel and marketing copy). The reachable `immediate` path settles each hop independently — so the "all-or-nothing / no partial payments" guarantee is FALSE as read. Sharpest instance: `compare/nevermined/data.ts:320-322` cites the two zero-caller functions as the "unique moat … shipped code" on a page whose thesis is "Claims anchored to shipped code." Pre-existing (the claim predates this sweep — `25fd6f6d`; the commit's `use-cases:149` B9 edit only stripped protocol names from an adjacent clause and left the multi-hop claim untouched; `compare/nevermined/data.ts` was not in the commit). Surfaces: `README.md:69`, `use-cases/page.tsx:149,151`, `docs/page.tsx:669,681,1921-1927`, `llms.txt:45,65,81`, `llms-full.txt:403,409,427`, `changelog/page.tsx:162-164`, `learn/handbook/page.tsx:589-597`, `learn/glossary/page.tsx:80-83`, `faq/page.tsx:227`, `compare/nevermined/page.tsx:384-385` + `data.ts:320-322`.
   → **Route to the DC-18 follow-up AND escalate to the launch-gate/security owner** (financial-integrity / published-falsehood angle; needs an owner ruling: wire the atomic path vs. demote the claim — the settlement code is FROZEN and claims-authoring routes to single-writer build, so NOT fixed here).

2. **[MED·MED] DC-18 surface inventory is too narrow.** AP2/Visa-TAP dark-rail "pay" claims live on `docs/page.tsx:351,355,359` and `compare/nevermined/page.tsx:381-384` ("merchants accept whatever protocol the buyer arrives with" — MPP off by default, Circle Nano testnet), surfaces the DC-18 follow-up scopes only to `[slug]`. → Expand the follow-up inventory beyond `[slug]`.

3. **[MED·borderline] DC-16d sibling-field — MPP `[slug]/page.tsx:66` `howItWorks`** asserts present-tense "SettleGrid verifies the SPT, **captures the payment**, … returns the result" while the rail is `Pending` (overview `:64` + integration `:68` correctly say "pending general availability"). Mitigated by the entry-level pending-GA framing; authoring a new claim → not self-blessed here. → Route to the follow-up / a light build pass for parity with the x402 `howItWorks` (B19) treatment.

4. **[LOW] Bucket-C blog** `lib/blog-bodies/ai-agent-payment-protocols.md:11,50,94` universal "settlement across the protocols it supports" — the handoff classified this file Bucket C (do-not-touch). Note as a follow-up candidate.

5. **[LOW/accepted] MPP "pending GA" not uniformly appended** in the brokered-9 enumeration (`llms.txt`, `about`, `handbook`, etc.) — consistent with the FROZEN adapter-coverage "9 brokered" framing + the §9.2 founder "brokers"-verb latitude. Accepted.

6. **[LOW] blog-posts.ts comment date-drift** — the DC-15 comment-fold added "Launched 2026-04-29" while the post's `datePublished`/`dateModified` are `2026-04-28` (non-rendered source comment; the public structured-data date is self-consistent). Trivial cleanup. **NOTE:** `published:true` was NOT flipped by this commit — it pre-existed (`25fd6f6d`, 2026-06-18); the commit only reconciled the stale drafting comment.

---

## 4. CROSS-REPO SEAM (operator action — LOUD)

**[MED→HIGH·HIGH] DC-20 (NEW class) — cross-repo split commit.** The settlegrid side is COMMITTED (`383436d7`); the entire `settlegrid-agents` demotion is **UNCOMMITTED working-tree only**, and agents `HEAD` (`db873ad`) STILL carries all four false strings (`beacon/prompts.ts:10` "x402 (production)", `protocol/prompts.ts:19` "production or pending GA", `:24` "Status: production in the Smart Proxy", `:86`, `shared/config.ts:147`). A `git checkout`/CI/cron build-from-HEAD at launch silently reverts the agents half and **re-arms the public-facing Beacon/Protocol amplifier agents with the false claims**. → **Operator must commit the `settlegrid-agents` working tree before any launch cron reactivation** (the ② seal bookkeeping assigned this; it is not yet done). Also **[MED]** the public-facing **Beacon** prompt lacks the x402 config-gate caveat that Protocol received, and x402 is now the lone unqualified brokered entry beside "Stripe MPP (pending GA)" — recommend adding the caveat parity before committing the agents repo.

The demotion itself is correct in the live text (all 4 production forms gone; x402 KEPT in the brokered 9; "brokers payments across 9 protocols" count intact; new guards homed + teeth; agents gate green 866p).

---

## 5. DEFECT-CLASS LEDGER — additions

- **DC-18b (NEW) — implemented-but-UNREACHABLE claim.** Prose cites a code path that is REAL but unreachable from any public surface (dead branch / zero-caller function), distinct from DC-18's stub/always-fail (adapter runs but no-ops). Cue: trace each cited path to a REACHABLE public entry point, not just to a function's existence + a unit test (which may call it directly). Instance: multi-hop atomic settlement (§3.1).
- **DC-20 (NEW) — cross-repo split-commit hazard.** A multi-repo chunk durable on one repo and ephemeral (uncommitted) on the other; build-from-HEAD on the uncommitted repo reverts that half. Cue: a multi-repo chunk is not sealed until BOTH repos are committed; seal bookkeeping must verify the cross-repo commit landed. Instance: §4.
- Recurrences (existing classes): DC-16c (regression-test evasion — §2, CLOSED) · DC-16d (sibling-field — §3.3, routed) · DC-18 (claim-vs-runtime on wider surfaces — §3.2, routed) · DC-15 (drift — §3.6, LOW).

---

## 6. VERDICT

**honest-claims-sweep ③: RE-CERTIFIED (HARDENED).** G1-1…G1-5 are complete, correct, and
frozen-clean on the integrated whole; the facilitator-live premise (Resolution A) is now
live-verified; the one toothless guard in the chunk's own regression test was hardened and
live-reproduced. The HIGH-severity multi-hop runtime overclaim and the cross-repo
uncommitted seam are **pre-existing / out-of-bucket** and are surfaced + routed (DC-18
follow-up + launch-gate/security; operator agents-commit) — they do not reopen this seal.

**Staged for this phase:** `apps/web/src/__tests__/honest-framing-regression.test.ts`
(the guard hardening) — commit alongside this record.
