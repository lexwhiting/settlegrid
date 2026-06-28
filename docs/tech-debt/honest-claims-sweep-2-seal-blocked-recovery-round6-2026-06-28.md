# ② SEAL-GATING REVIEW (RE-②, round 6) — 🔴 BLOCKED → BUILD RECOVERY — honest-claims-sweep — 2026-06-28

**Outcome:** ② **BLOCKED** (could not seal). Routed to the recovery loop → back to build, then re-②.
This is the SIXTH ② block. The round-1→5 deltas (B1–B18, T1–T3, L3) are **applied correctly and
PRESERVED** — this is a focused DELTA on the existing working tree, **NOT a redo**. The block is the
**SIXTH recurrence of the incomplete-sweep class (DC-16d/DC-16g/DC-16h)**: the round-5 B16/B17/B18 fix
reconciled the `/docs` x402 cluster and the protocol badges correctly, but left two SIBLING settlement
claims un-reconciled — one of them a *within-entry* self-contradiction on the very `/learn/protocols/x402`
detail page the round was editing (overview demoted "metering layer is in development" while the
howItWorks paragraph still asserts that layer live).

**Gate is GREEN** (independently re-run from scratch TWICE this session — every check ran, evidence below):
settlegrid `tsc 0` / `lint 0` (warnings only) / `vitest 209 files · 4857 passed` (incl. honest-framing);
agents `tsc 0` / `vitest 21 files · 866 passed`. The web vitest count moved 4853→**4857** vs the round-5
②-BLOCK digest — exactly the **+4 new B16 `it`-blocks** (test:818/826/832/838), so the round-5 delta is
fully accounted for and the gate genuinely ran on the built code. **All frozen surfaces intact.**

**Round-5 delta verified CORRECT and PRESERVED (do NOT redo):**
- **B16 CONFORMS** (spec-conformance lens, integrator-reproduced): the `/docs` x402 cluster is reconciled
  to ONE Resolution-A status — `:326`/`:342` keep the live-facilitator claim; the five categorical denials
  (`:75/:211/:330/:334/:338/:359`, plus the in-docs Nevermined `:673`) are re-scoped to the in-development
  hosted-proxy/platform path. The mandated exhaustive `git grep` over `docs/page.tsx` + the cross-surface
  demotion-phrase scan were re-run by the integrator: no surviving line categorically denies x402 on-chain
  settlement; the only remaining "x402 … not currently available" string is the **truthful runtime proxy
  error** at `api/proxy/[slug]/route.ts:1921` (frozen, not marketing copy).
- **B17 CONFORMS**: x402 status badge reconciled to ONE value `'Production'` across `learn/protocols/page.tsx`,
  `learn/protocols/[slug]/page.tsx`, and `protocols/x402/facilitator/page.tsx:111` (matches Resolution A); no
  new enum value invented; badge guarded on BOTH index and detail (symmetric — DC-16f clear).
- **B18 CONFORMS**: `[slug]:122` integration scoped so "not currently available" no longer sits beside the
  three live `/api/x402/*` endpoints.
- **B16 guards HAVE TEETH** (guard-teeth lens, empirically harness-verified): positive anchor (test:818) is
  HEAD-reachable RED→GREEN; all three negatives (test:826/832/838) were **driven RED by injection** then
  reverted. No dead regex. No over-match on kept strings.
- **Frozen intact** (scope lens): no diff under `lib/settlement`/`env.ts`/`api/proxy`/`api/x402`/`api/circle-nano`/
  auth; `.well-known/mpp.json` untouched; "9 brokered"/"brokers" framing preserved; facilitator landing page +
  `blog-posts.ts` published-state untouched; stats-bar 95–100% / 50K ops unchanged.
- **Cross-repo (settlegrid-agents) CLEAN**: `beacon/prompts.ts`/`protocol/prompts.ts`/`shared/config.ts`
  consistently mark MPP "pending GA", x402 on-chain "config-gated", Circle/L402 scoped; no un-darkening; a
  separate cohesive commit in its own repo.

**Review:** 4 decorrelated fresh-context Agent-tool lenses — completeness/SEAM (core-invariant) ·
spec-conformance · guard-teeth/literal-execution · scope-boundary/frozen+commit-hygiene — all
`claude-opus-4-8[1m]`. **Effort report-back: all 4 ran at `high`, NOT the operator-selected `xhigh`** (the
Agent-tool spawns inherit session effort and expose no effort param; PATH 1 mixed-effort named-subagent defs
still do not exist — no `.claude/agents/` directory). `high` is the policy FLOOR for seal-deciding reviewers,
so the review is valid; recorded per the effort report-back guard. **5th consecutive round the `/effort xhigh`
request has not taken effect via the Agent-tool path** — see §7. Outcome BLOCKED on concrete,
integrator-reproduced findings (and the code will change in recovery), so a same-pass `xhigh` re-run was not
spent. Env traps unset (no `CLAUDE_CODE_EFFORT_LEVEL`/`SUBAGENT_MODEL`/`FORK_SUBAGENT`); allowlist GREEN
(git/tsc/vitest/lint); operator chose Agent-tool spawns over a workflow (allowlist-GREEN moots the loud-pause
edge). Every load-bearing finding below was **live-reproduced first-hand by the integrator** (file:line read +
`git show HEAD:` diff check + `api/proxy` code-path trace) before triage. The completeness/SEAM lens (reading
semantically) caught B19/B20/B21 — the keyword greps miss them because they name no x402/demotion keyword.

---

## ⚠ 0. PROCESS INCIDENT — destructive revert during the review (recovered; new ledger entry)

The **guard-teeth lens** reverted its temporary RED-injection edits with `git checkout -- <file>`. On this
chunk that is **destructive**: honest-claims-sweep is 100% uncommitted (HEAD = d68d3b65 predates the chunk),
so `git checkout -- <file>` resets the file to **HEAD**, discarding ALL round-1→5 working-tree deltas — not
just the injection. It wiped the round-5 state of `learn/protocols/page.tsx` and `learn/protocols/[slug]/page.tsx`.
The reviewer recovered them from Claude Code's `~/.claude-4/file-history/` snapshots + its captured Reads.
**The integrator independently verified the recovery is byte-identical to the captured pre-clobber build diff**
(both files compared hunk-by-hunk against the diff captured earlier in this session, incl. the `// Resolution A`
comment the reviewer thought it had "inferred" — it matches exactly) **and re-ran the gate from scratch GREEN**
(4857/866). No residue: the docs injection was fully reverted; tree = 27 tracked changes, no strays.
(The transient mid-clobber state is why the completeness lens reported a spurious "two files reverted to HEAD"
Finding 1 — that was the artifact, not a build defect.)

**New defect/process class — DC-17 (uncommitted-chunk destructive revert):** on a fully-uncommitted chunk,
NEVER revert a temporary edit with `git checkout`/`git restore`/`git stash` on a tracked, already-modified
file — it loses the working-tree delta. Revert ONLY with an inverse `Edit` (string→string). **Root cause is
partly the reviewer brief**, which offered `git checkout -- <file>` as a revert option; the next ②'s guard-teeth
brief MUST mandate inverse-Edit-only reverts and explicitly forbid checkout/restore/stash on the chunk's files.

---

## 1. BLOCKING FIX — the seal failed on this

### B19 — `/learn/protocols/[slug]` (x402 entry) self-contradicts WITHIN the entry: overview (demoted this sweep) says the metering layer "is in development" but howItWorks ¶3 still asserts it live  [HIGH — BLOCKING]
*SIXTH recurrence of the incomplete-sweep class, here WITHIN a single entry the round was editing. The round
demoted the x402 `overview` + `integration` but left the sibling `howItWorks` paragraph describing the same
in-development metering layer as a present-tense live capability. Flagged by the completeness/SEAM lens,
integrator-reproduced live.*

File `apps/web/src/app/learn/protocols/[slug]/page.tsx`, the x402 protocol entry:
- `:118` **overview (reconciled this sweep):** "SettleGrid runs a public x402 facilitator (verify + settle on
  Base) as a standalone service; **the metering, budgets, and analytics layer SettleGrid adds on top — and
  settling x402 through the hosted proxy for your own tool's revenue — is in development.**"
- `:120` **howItWorks ¶3 (UNCHANGED — still live):** "**SettleGrid extends x402 with credit-based budgets,
  rate limiting, and analytics.** Instead of raw on-chain verification on every call, consumers can pre-fund a
  credit balance with USDC and **SettleGrid handles the metering.** This reduces gas costs and latency…"

The overview says the metering/budgets/analytics layer **is in development**; the howItWorks paragraph one
field away says SettleGrid **does** extend x402 with budgets + analytics and **handles the metering** — the
exact same layer, asserted live. This is the **same within-surface self-contradiction class as the B16 blocker
just fixed in `/docs`**, now on the `/learn/protocols/x402` detail page.

**Apply (authors NEW public-claim wording → single-writer build):** scope the howItWorks ¶3 metering/budgets/
analytics description to the in-development hosted-proxy/platform layer (mirror the overview's wording), or move
it under a "When the platform layer is live, …" framing consistent with the `:122` integration field. Keep the
facilitator verify+settle-on-Base framing intact (that part is live and correct).
**New guard (git-reachable RED from HEAD):** the HEAD `[slug]` x402 howItWorks already carries this live phrase,
so add a `PROTOCOL_SLUG_TSX` negative pinning the retired live-metering phrase — it fires RED on HEAD and GREEN
after the demotion (real committed teeth, unlike the forward-only negatives).

---

## 2. SHOULD-FIX — fold into the SAME delta (the settlement-claim cluster is already being reopened)

### B20 — `/learn/how-mcp-billing-works:193` categorically "settles the payment through the appropriate rail" for every detected protocol, incl. config-dark x402 + Circle Nano  [MED]
*Same class as the round-3 B6 demotion (`docs:359` "settlement across every protocol"). Survived 5 rounds
because the sentence names no x402/demotion keyword, so the greps miss it; the completeness lens read it
semantically.*
- `apps/web/src/app/learn/how-mcp-billing-works/page.tsx:193`: "SettleGrid handles protocol negotiation
  automatically. When a consumer (agent) initiates a payment, SettleGrid detects the protocol …, validates the
  payment according to that protocol's rules, and **settles the payment through the appropriate rail.**"
  Read after `:192` ("a crypto-native agent uses x402"), this asserts SettleGrid currently settles x402 (and
  Circle Nano) live — contradicting `api/proxy/[slug]/route.ts:1921` ("x402 settlement is not currently
  available"), `:2089` (Circle Nano same), and the now-reconciled `/docs` cluster.
- **Apply:** scope `:193` so settlement is live for fiat (cards/Stripe Connect) and on-chain rails (x402 via the
  hosted proxy, Circle Nanopayments) + Stripe MPP are in development — e.g. "…validates the payment according to
  that protocol's rules, and settles fiat payments through Stripe Connect today; on-chain settlement (x402 via the
  hosted proxy, Circle Nanopayments) is in development." Soften `:192`'s present-tense MPP/x402 to match.
  (`:176` "9 brokered … pending GA" is defensible under the frozen adapter-coverage definition — leave it.)

### B21 — `[slug]` Circle Nano code-example comment still says "managed automatically" while its overview was demoted to "in development, testnet only"  [MED-LOW]
- `apps/web/src/app/learn/protocols/[slug]/page.tsx:346` (Circle Nano `codeExample`): "// Circle Nanopayment
  channels are **managed automatically**" — the round demoted Circle's overview/howItWorks/integration to "in
  development, testnet only" but left this code comment asserting live/auto. Within-entry inconsistency (the MPP
  code comment WAS demoted to "// When MPP is enabled (pending GA)").
- **Apply:** qualify the comment, e.g. "// Circle Nanopayment channels (in development, testnet only)".

---

## 3. LOW / fold-while-open or defer with rationale (not independently blocking)
- **Forward-only disclosure on the B16 negative guards** (guard-teeth + spec lenses, LOW): the B16 negatives
  (test:826/832/838) pin retired categorical phrases that exist on NO committed tree (chunk is uncommitted) — they
  are injection-provable re-introduction tripwires but have **no git-reachable RED**, like B11#1/B14/B15. The
  comment at test:824 implies a committed pre-fix RED ("RED pre-fix (present)"). **Add a one-line FORWARD-ONLY
  DISCLOSURE** (mirror B11#1/B14/B15 at test:719/766/779). The HEAD-anchored positive (test:818) carries the real
  teeth, so coverage holds.
- **B17 badge-guard comment accuracy** (guard-teeth lens, MED→treat as LOW comment-fix): test:566-567 claims the
  x402 badge guard "fires RED on the pre-fix tree (the entry still carried 'Testnet')" — but at HEAD the badge is
  already `'Production'` (the `'Testnet'` lived only in the uncommitted round-1→4 intermediate), so the positive
  half has **no committed RED→GREEN**. The negative half (not `'Testnet'`) is injection-provable, so the guard is
  NOT dead. **Add a FORWARD-ONLY DISCLOSURE** noting HEAD was already 'Production'.
- **`llms-full.txt:275` names the vanity host `facilitator.settlegrid.ai`** — **RESOLVED → Resolution A (reachable):
  KEEP the hostname.** [was MED-FOUNDER; resolved by research 2026-06-28] The round-4/5 "blog is a draft / not yet
  reachable" premise was a **MISREAD of a stale comment**. The launch blog is actually `published: true` at HEAD
  (committed — `blog-posts.ts:700`), and the project's own DNS runbook (`docs/launch/x402-facilitator-dns-runbook.md`
  **Step 5**) makes `published:true` a strict consequence of **Step 4 (external smoke-test from outside the network)
  passing green** — so the committed flip means the facilitator was DNS-provisioned + smoke-tested and is live.
  Corroborated by dated "shipped facilitator.settlegrid.ai 2026-04-29" comments (`compare-nevermined.test.ts:415`,
  `data.ts:250`), the P4.MKT3 `/compare/nevermined` rebuild predicated on it being live, the `vercel.json:83` host
  rule, and the founder-greenlit isolated gas wallet (`df60d8ce`). **Optional belt-and-suspenders before the round-6
  seal:** founder runs `bash scripts/x402-facilitator-smoke.sh` (read-only, malformed payloads, no gas spend, <30s,
  3 green checks expected); if RED, fall back to Resolution B (soften to `settlegrid.ai/api/x402/facilitator/v1/*`).
- **DC-15 stale-comment reconciliation [LOW — fold to kill the recurring reachability confusion]:** the "pending
  founder action / published:false until DNS provisioned" comments are STALE (the action completed; the flag is
  flipped). They are the ROOT CAUSE that made rounds 4/5/6 re-litigate reachability. While the x402 cluster is open,
  reconcile at least **`blog-posts.ts:664-670`** (the drafting comment — a content/marketing file, clearly in scope:
  reword to "Launched 2026-04-29; DNS provisioned + smoke-tested green per the runbook") and the
  **`scripts/x402-facilitator-smoke.sh`** header. LEAVE `api/x402/facilitator/v1/supported/route.ts:20-24` (frozen
  api/x402 surface this chunk must not touch) — note it for a separate comment-only cleanup, or let the next ③/owner
  handle it; do NOT pull it into this delta and risk the frozen boundary.

## 4. DEFER / ACCEPT (founder latitude — do NOT block)
- **README count tension** [LOW]: `1,017 servers` (indexed) vs `97 open-source templates with billing pre-wired`
  vs `17 quickstart guides` — different denotations, defensible; a casual reader could misread 97-vs-1,017. Accept,
  or add a one-word clarifier ("1,017 *indexed* servers"). Founder call.
- **Other `[slug]` code comments**: `:466` ACTP "// Alipay Agent Tokens are accepted automatically" + `:545` EMVCo
  "// EMVCo tokens **will be** verified automatically" (future-tense, softer) + `:198`/`:309` Visa-TAP/Mastercard
  "verified automatically" (detection adapters) + `:133` x402 "// x402 payments are verified automatically"
  (arguably TRUE — the facilitator verify is live). **Default: leave**; but while fixing B21, eyeball `:466` ACTP
  for parity (it's a config-dark rail needing `ALIPAY_APP_ID`). Not blocking.
- All prior-round deferred items unchanged (Testnet≡Production amber styling; agents "1,444 tools" §9.1; F-data
  dead links; "9 brokered" counts the dark rails — FROZEN, honest by the adapter-coverage definition).

---

## 5. DEFECT-CLASS LEDGER — sixth recurrence + new process class (fold into handoff §8)
- **DC-16 SIXTH RECURRENCE (B19/B20/B21):** when you demote a primitive's status on a surface, re-scan and
  reconcile ALL sibling claims about that primitive — across **fields of the same entry** (overview vs howItWorks
  vs integration vs codeExample comments), not just the named field, AND across cross-surface twins. R1 = index↔detail
  badge; R2 = a prose section in a long file; R3 = universal-quantifier FAQ + orphaned `.html` + badge↔prose;
  R4 = a deleted claim's surviving identical twin; R5 = a newly-introduced LIVENESS claim left un-reconciled vs its
  demoted FAQ siblings; **R6 = a demoted `overview` left un-reconciled vs the sibling `howItWorks`/`codeExample`
  fields in the SAME entry, + a cross-surface "settles through the appropriate rail" universal claim that names no
  keyword.** Recurring root: hand-listing/keyword-grepping a SUBSET of fields instead of reading every field of the
  primitive's entry semantically. **Build must, before declaring done, read EVERY field (overview/howItWorks/
  integration/codeExample) of every config-dark/in-dev protocol entry in `[slug]/page.tsx` and reconcile each, AND
  scan all `/learn` + `/docs` + `components/marketing` surfaces for present-tense universal settlement verbs
  ("settles … through the … rail", "settlement across", "handles the metering", "extends x402 with … budgets")
  that imply dark rails are live.**
- **DC-17 NEW (uncommitted-chunk destructive revert):** see §0. Reviewer briefs must forbid `git checkout`/
  `restore`/`stash` on an uncommitted chunk; revert temp edits with inverse `Edit` only.

---

## 6. GATE TO RE-PASS, then re-②
- settlegrid (`apps/web`): `npx tsc --noEmit` → 0; `npm run lint` → 0 err; `npx vitest run` → all pass incl. the
  EXTENDED honest-framing test (the NEW B19 howItWorks guard proven RED→GREEN from HEAD; the B20/B21 demotions; the
  forward-only disclosure comments do not change counts).
- settlegrid-agents: `npx vitest run` → green; `npx tsc --noEmit` → 0 (UNCHANGED this delta — agents prompts already
  reconciled).
- Then **re-enter ②** (high-stakes; ② is the seal gate; ③ post-seal deep audit follows on a clean seal).

## 7. EFFORT — durable recommendation (5th-round-recurring; unchanged from round-5 §7)
`/effort xhigh` selected via the option prompt has NOT propagated to the Agent-tool spawns in rounds 2/3/4/5/6
(they inherit session effort, expose no effort param). To realize a higher-recall pass on the next re-②, either
(a) **stand up PATH-1 effort-bearing reviewer definitions** under `.claude/agents/` (core-invariant=`max`, seal
reviewers=`xhigh`, refuters=`high`, each `model: claude-opus-4-8`) **before** the phase — a freshly-written def
may not load until session reload, so it is an operator/setup step; or (b) accept `high` (the floor) and lean on
the integrator's **foreground completeness grep + a semantic full-field read of each protocol entry** — which is
what caught B19/B20/B21 this round. Given the recall-bound defect class, (a) is the durable fix; (b) has empirically
kept converging on the blocker.

## 8. COMMIT HYGIENE — apply at SEAL time (unchanged; re-confirmed by the scope lens this round)
Commit ONLY the claims + regression-test files + the `honest-claims-sweep-*.md` docs (handoff, seal-record, all
SIX recovery rounds). **EXCLUDE:** `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (own commit —
unrelated DB-credential status update; note: it now reads "RESOLVED — rotated", which the user's MEMORY index still
lists as an open P0 — a memory/doc drift for the founder to reconcile); the **slugify hunks** in
`(dashboard)/dashboard/tools/page.tsx` (patch-stage ONLY the `:643` "1,017"→"servers" hunk via `git add -p` — the
three hunks at ~221/~421/~643 are cleanly isolable, confirmed); untracked cross-chunk paths (`.claude/`,
`docs/tech-debt/launch-gate-queue.md`, the v-n3 MFA handoff, `scripts/mfa-delete-smoke.sh`). **NEVER** `git add -A`
/ `git commit -a`. settlegrid-agents is a separate cohesive commit in its own repo.
