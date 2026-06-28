# ② SEAL-GATING REVIEW (RE-②, round 2) — 🔴 BLOCKED → BUILD RECOVERY — honest-claims-sweep — 2026-06-27

**Outcome:** ② **BLOCKED** (could not seal). Routed to the recovery loop → back to build, then re-②.
This is the SECOND ② block. The first block's delta (B1 x402-index / B2 L402 / B3 MPP-badge / T1 sub-ms /
T2 denomination + the badge-layer guards) was **applied correctly and is PRESERVED** — see the recovery
record `honest-claims-sweep-2-seal-blocked-recovery-2026-06-27.md` and the seal record's R1–R7 section.
The build is now ~95% correct. **This is a focused DELTA on the existing working tree, NOT a redo.**

**Gate is GREEN** (independently re-run from scratch this session, matches the recovery digest exactly):
settlegrid `tsc 0` / `lint 0` (warnings only) / `vitest 209 files · 4840 passed` / honest-framing `80 passed`;
agents `tsc 0` / `vitest 21 files · 866 passed`. **All frozen surfaces intact.**

**Review:** 5 decorrelated fresh-context Agent-tool lenses — truth/over-correction · spec-conformance ·
completeness/SEAM · literal-execution/guard-teeth · scope-boundary/frozen+commit-hygiene — all
`claude-opus-4-8[1m] @ high` (the policy floor; PATH 1 unavailable — no `.claude/agents` effort-bearing
defs exist, the Agent tool exposes no effort param → `xhigh`/`max` target UNMET; recorded per the
effort report-back guard. `high` surfaced concrete, live-reproduced findings; integrator verified each
first-hand). Env traps unset; allowlist GREEN (git/tsc/vitest/lint/npm test). Operator chose Agent-tool
spawns over a workflow (allowlist-GREEN moots the workflow loud-pause edge; ② is not a large ③ audit).

---

## 1. WHAT THE BUILD GOT RIGHT — PRESERVE, do NOT redo
- **Badge layer harmonized index ↔ detail** (the prior block's defect class — CLOSED). All 15 rails agree
  rail-by-rail across `learn/protocols/page.tsx` and `[slug]/page.tsx`: MCP/REST `Production`,
  MPP/AP2/Visa-TAP/UCP/ACP/KYAPay `Ready`, x402/Circle/L402/DRAIN `Testnet`, Mastercard/ACTP/EMVCo `Pending`.
- **B1/B2/B3/T1/T2 all applied** per the round-1 recovery spec (spec-conformance lens: every prescribed
  change present, no over-reach beyond the founder-authorized L402/badge layer; education preserved).
- **SEAM verified** (completeness lens, first-hand by integrator): the new prose is backed by the code gates
  — `isMppEnabled()===!!STRIPE_MPP_SECRET` (env.ts:138), `isX402SettlementEnabled` / `isCircleNanoKernelEnabled`
  / `isL402Enabled` (env.ts) all gate dispatch in `api/proxy/[slug]/route.ts` (475 / 1919 / 483 / 518);
  `@upstash/redis` is an HTTP/REST client (redis.ts) so the magnitude-free "single Redis balance check on
  the hot path" wording is correct; the L402 adapter matches the "detection adapter / mock invoices without
  LND" prose.
- **T1 sub-ms / <50ms / USDT / 15-protocol / 1,017-templates** — zero live residuals in marketing/public
  prose (remaining hits are test guards, settlement-code comments, and legitimate historical/citation text).
- **Frozen intact:** "9 brokered" count + verb; `mcp.json protocols[]` length 11; the uncommitted slugify
  hunk in `(dashboard)/dashboard/tools/page.tsx` (only the `:646` line is this chunk's edit); all
  money/auth/settlement code; dark-crypto config (nothing un-darked); stats-bar `:6/:7`.
- **Guard teeth (mostly):** every G1-1..G1-4 + B1/B2/B3 badge+prose assertion has REAL teeth against the
  committed baseline (guard-teeth lens refuted the feared `\s*`-across-newline and index-vs-detail-backer
  defects: JS `\s` spans `,\n    `, and the builder correctly used the per-file backer string `'Lightning
  Labs'` vs `'Lightning Labs (Bitcoin)'`).

---

## 2. BLOCKING FIX — the seal failed on this

### B4 — `docs/page.tsx` MPP section is a live self-claim while MPP is config-dark / pending-GA  [HIGH·HIGH]
*Completeness recurrence — DC-16b / DC-16d. B3 demoted MPP on the protocol pages but did NOT re-scan MPP's
sibling self-claims, so the `/docs` "Accepting MPP Payments" section shipped its live "zero configuration"
claim un-demoted — the SAME sibling-inconsistency class that blocked the FIRST seal (x402 index vs detail).*

`apps/web/src/app/docs/page.tsx`, Section "Accepting MPP Payments" (`id="mpp"`, ~lines 1809–1861):
- **:1812** — "SettleGrid **natively accepts** Stripe MPP … Any agent using Stripe MPP can pay for your
  SettleGrid tools seamlessly — **zero configuration required**." → **FALSE.**
- **:1850** — "Tools **accept both** MPP (SPT) and traditional API key payments. **No code changes needed**."

**Why it's false / blocking (verified first-hand this session):**
1. `isMppEnabled()` is literally `return !!process.env.STRIPE_MPP_SECRET` (env.ts:138); the proxy dispatches
   MPP only `if (isMppEnabled() && isMppRequest(request))` (route.ts:475). MPP is config-gated → "**zero
   configuration required**" is false; configuration (the secret) is REQUIRED.
2. It **self-contradicts** `:1854` of the SAME section: "Set `STRIPE_MPP_SECRET` to enable MPP payments.
   Optional — SettleGrid works without it."
3. It **contradicts the chunk's own B3 demotion**: the protocol pages now say MPP is "**pending general
   availability** … enabled per deployment via the `STRIPE_MPP_SECRET` configuration." Shipping this chunk
   would publish a self-contradiction (pending-GA on /learn/protocols vs zero-config-live on /docs).
4. **Unguarded:** the honest-framing test references `DOCS_PAGE_TSX` only for the crypto/USDT/latency guards;
   there is NO assertion against the MPP "zero configuration required" / "natively accepts" claim
   (the B3 guards pin only `PROTOCOLS_INDEX` + `PROTOCOL_SLUG_TSX`). This gap is why B4 shipped.

**Live reproduction (the seal's filter):** `expect(DOCS_PAGE_TSX).not.toMatch(/zero configuration required/i)`
FAILS against the current tree (phrase present at :1812) → it will pass once the prose is demoted.

**Apply (mirror the already-approved protocol-page wording; KEEP the mechanism/cURL walkthrough as education):**
- **:1812** drop "natively accepts … zero configuration required" → e.g. "SettleGrid's MPP integration is
  **pending general availability**: when enabled per deployment via the `STRIPE_MPP_SECRET` configuration,
  SettleGrid tools accept Stripe MPP Shared Payment Tokens alongside traditional API keys." (mirror
  `[slug]/page.tsx:64/:68`.)
- **:1850** "Dual payment … **No code changes needed**" → soften to "When MPP is enabled, tools accept both
  SPT and API-key payments" (drop the absolute "no code changes / zero config"). `:1854` already states the
  flag is required — make :1812/:1850 consistent with it.
- The "How MPP Works" numbered flow + cURL example (`# Response: 200 OK`) may stay as mechanism education
  (it describes the designed flow), but the SECTION FRAMING (:1812) must lead with "pending GA / when enabled".
- **Re-scan EVERY MPP representation (DC-16d — do NOT patch only these lines):** `git grep -niE
  "MPP|Machine Payments|Shared Payment Token|SPT" -- apps/web/src apps/web/public README.md` and the agents
  repo; triage each as live-self-claim (demote) vs education vs the frozen 9-brokered/Bucket-B list (keep).
  Known soft sibling to resolve in the same pass: **`public/llms-full.txt:271-272`** — the MPP entry
  "SettleGrid supports MPP … with automatic metering" carries NO pending-GA qualifier while the x402/Circle/
  L402 entries in the same file were demoted. **Default:** add a "(pending GA)" / "when enabled" qualifier to
  the MPP entry (MPP is uniquely flagged "pending GA" on 6 canonical surfaces — `docs:54`, `faq:48`,
  `how-mcp-billing:176`, `api/chat:33`, README/llms lists — unlike the other `'Ready'`-tier fiat rails
  AP2/ACP/UCP, whose plain present-tense "supports" stays).
- **New regression guard (prove RED pre-fix → GREEN post-fix; capture both):** add to the B1/B2/B3 describe
  block: `expect(DOCS_PAGE_TSX).not.toMatch(/zero configuration required/i)` AND
  `expect(DOCS_PAGE_TSX).not.toMatch(/natively accepts Stripe MPP/i)` (file-scoped value-literals; both fire
  RED on the current tree). Optionally pin the llms-full MPP entry once worded.

---

## 3. SHOULD-FIX — fold into the SAME delta (the badge layer is already being reopened)

### B5 — x402 detail-page badge is demoted but UNGUARDED (asymmetric guard coverage)  [MED·HIGH]
*New defect class — see §6 (DC-16f). The regression guard is the chunk's whole deliverable; an asymmetric
guard leaves the demoted detail badge unprotected.*
`apps/web/src/__tests__/honest-framing-regression.test.ts:554-556`: the B1 x402 guard pins only
`PROTOCOLS_INDEX`. The MPP (562-563) and L402 (576-577) guards pin BOTH `PROTOCOLS_INDEX` and
`PROTOCOL_SLUG_TSX`. The detail x402 badge (`[slug]/page.tsx:112`) was demoted `Production`→`Testnet` in
this sweep, but nothing pins it — a regression flipping it back to `Production` passes the suite.
- **Apply:** add `expect(PROTOCOL_SLUG_TSX).not.toMatch(/backer: 'Coinbase',\s*status: 'Production'/)`.
- **Also correct the inaccurate comment** at test:551-553 ("the [slug] detail page already reads 'Testnet'")
  — the detail badge was `'Production'` at HEAD and demoted in THIS sweep, not "already" demoted.

---

## 4. BORDERLINE — resolve in the same pass (defaults given; not independently seal-blocking)

### T3 — L402 `'Testnet'` badge precision  [MED·MED]
Truth lens: L402's no-config path emits MOCK invoice strings (not a real testnet Lightning rail), its prose
says "in development and not currently available", and unlike x402/Circle (genuine Base Sepolia e2e) there is
no dedicated Lightning-testnet settlement path — so `'Testnet'` arguably over-states a working testnet rail.
**Counter:** with a configured (testnet) LND, L402 generates real invoices; `isL402Enabled` mirrors x402/Circle;
the recovery deliberately chose `'Testnet'` to harmonize the dark rails, and the prose is honest. **The prose
is not false → not independently blocking.** **Default:** keep `'Testnet'` (harmonized, documented). **Founder
option:** demote to `'Pending'` (the gray in-development bucket, parity with Mastercard/ACTP/EMVCo) for
precision. If changed, update the L402 badge guards (index+detail) in lockstep.

### T4 — `Testnet` ≡ `Production` identical amber styling  [LOW·HIGH]
`StatusBadge` maps BOTH `'Production'` and `'Testnet'` to the same amber (`bg-amber-500/10 text-amber-400`),
so the x402/L402 demotions are visually muted — only the text label changes. **PRE-EXISTING** (the `'Testnet'`
styling predates this chunk via Circle/DRAIN) and **out of the claims-text scope** — restyling would be
gold-plating on a frozen-ish UI surface. **Recommend: do NOT fix here**; note as a founder UX follow-up (give
`'Testnet'` a distinct color if visual demotion is desired).

---

## 5. DEFERRED — route to follow-up, NOT this chunk (unchanged from round 1 + new LOWs)
- **F-data ≥63 dead fork links** (`server-catalog.json` 1017 vs 954 committed dirs) — pre-existing catalog
  drift. → launch-gate queue / data task.
- **F4 "1,444+ tools indexed"** (`agents/beacon/prompts.ts:18`) — founder reconciliation (991→97 done).
- **tools/page.tsx noun mix** (Lens 2 LOW): body `:110` says "servers" but the sibling card heading/link still
  say "template(s)". Cosmetic; not a false numeric claim (97 templates exist). Optional tighten.
- **billing-verb nit** ("add your API key" vs "add SettleGrid billing") — conservative, not false.
- **Optional test robustness** (recovery round-1 §4, still deferred): `(dashboard)/dashboard/tools/page.tsx:646`
  not in `TEMPLATE_COUNT_CONFLATION` file-list; `/USDT/` not word-bounded. No live false claim depends on them.
- **"9 brokered" counts the dark rails** (Lens 1 LOW) — FROZEN, founder-decided, honest by the
  adapter-coverage definition (`15-protocol-claim.md:67`). No action.
- **"single Redis balance check" = exists()+decrby() under the hood** (Lens 1 LOW·LOW) — defensible
  architectural prose, carries no magnitude. "metering batched asynchronously" mirrors pre-existing accepted
  SDK copy (`blog-posts.ts:169`, `howto-guides.ts:67`) and metering IS off-hot-path async. No action.

---

## 6. DEFECT-CLASS LEDGER — new recurrence + new class (fold into handoff §8)
- **DC-16b / DC-16d RECURRENCE (B4):** when a status/claim is demoted for ONE protocol, re-scan THAT
  protocol's self-claims across ALL surfaces (docs sections, llms, FAQ, agents), not just the badge layer.
  B3 harmonized MPP's badge on the protocol pages but missed the MPP prose family in `docs/page.tsx`
  (a dedicated `id="mpp"` section deep in a 1900-line file) and `llms-full.txt`. Cue: grep the protocol NAME
  + its capability verbs ("accepts/supports/natively/zero config"), not just the `status:` enum.
- **DC-16f (NEW — asymmetric regression-guard coverage) (B5):** a guard that pins a demoted claim on the
  index but not the demoted-sibling detail (or vice-versa) leaves the unpinned representation unprotected.
  Cue: every demoted representation gets its OWN guard, symmetric across index ↔ detail ↔ docs.

---

## 7. GATE TO RE-PASS, then re-②
- settlegrid (`apps/web`): `npx tsc --noEmit` → 0; `npm run lint` → 0 err; `npx vitest run` → all pass incl.
  the EXTENDED honest-framing test (the new DOCS_PAGE_TSX MPP guards proven RED pre-fix → GREEN post-fix).
- settlegrid-agents: `npx vitest run` → green; `npx tsc --noEmit` → 0 (agents repo likely UNCHANGED this
  delta — B4/B5 are settlegrid-only — but re-run to confirm).
- Then **re-enter ②** (high-stakes; ② is the seal gate; ③ post-seal deep audit follows on a clean seal).

---

## 8. COMMIT HYGIENE — apply at SEAL time (unchanged from round 1)
Commit ONLY the claims + regression-test files. **EXCLUDE:**
`docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (own commit — confirmed unrelated DB-credential
status update); the **slugify hunk** in `(dashboard)/dashboard/tools/page.tsx` (patch-stage only `:646` via
`git add -p`); untracked cross-chunk paths (`.claude/`, `docs/tech-debt/launch-gate-queue.md`, the v-n3 MFA
handoff, `scripts/mfa-delete-smoke.sh`). The three `honest-claims-sweep-*.md` docs (handoff, seal-record, both
recovery records) ARE in-scope. **NEVER** `git add -A` / `git commit -a`. settlegrid-agents is a separate,
cohesive commit in its own repo (no shared gate).
