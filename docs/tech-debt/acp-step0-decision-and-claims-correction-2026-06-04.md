# ACP Step-0 decision + public-claims update — chunk record (2026-06-04)

> Chunk record for the P5 Step-0 outcome (2026-06-04). The nominal target (ACP kernel
> wiring) was Step-0-gated; founder-directed research resolved it into THIS chunk:
> update the public ACP market story to the full (fact-checked) arc + record ACP's
> roadmap position. No settlement surface is touched (copy + docs only) → the
> funds-safety SEAL panel is N/A; the gate was an independent fact/framing verification
> fan-out on the actual diff plus the standard build gates.
>
> **⚠️ The verification gate EARNED ITS COST here:** the R1 adversarial fact-check
> REFUTED the first-draft correction (which claimed ACP adoption "exploded" to 1M+
> onboarding merchants). Ground truth is a three-act arc — see §1. The copy was
> rewritten and re-verified (R2: SAFE-TO-PUBLISH, 0 refuted). Recorded in §7.

---

## 1. Step-0 outcome — the fact-checked ACP arc

**Founder question:** should OpenAI/ACP merchant onboarding be on the roadmap
(strongest-position groundwork) or is it superfluous noise?

**The arc (every leg multi-source; see §5):**
1. **Sept 29, 2025** — Instant Checkout launches in ChatGPT, Etsy live; ACP spec
   released, co-maintained by OpenAI + Stripe.
2. **Oct 28, 2025** — PayPal announced as an ACP-compliant payment server (SMB
   catalogs slated 2026).
3. **Feb 16, 2026** — "Buy it in ChatGPT" expansion ANNOUNCED: 1M+ Shopify merchants
   slated (Glossier, SKIMS, Vuori), all-US availability.
4. **Activation never followed** — only ~12–30 Shopify merchants ever went live.
5. **March 24, 2026** — OpenAI SUNSET in-chat Instant Checkout; pivot to
   discovery-first (ChatGPT does research/intent; merchants keep their own checkout,
   still under ACP — TechCrunch: the discovery model "is powered by ACP").
6. **Post-pivot, the SPEC continues to broaden** — multi-PSP implementations (PayPal,
   Checkout.com, Mollie, Worldpay, Worldline, Spreedly, FIS, Nexi), April 17 2026 spec
   release (cart, feed, orders, authentication, MCP capabilities), a Delegated Payment
   spec for agent-initiated buys.

**Layer framing (industry consensus):** ACP = consumer discovery/checkout layer ·
AP2 = authorization · x402/MPP = M2M settlement. SettleGrid's monetizable core is the
settlement layer; for ACP, SettleGrid would be a **verification facilitator** (AP2
model — no funds through SettleGrid).

**What was actually wrong on the public surface:** the state-of-mcp page's "only 12
Shopify merchants activated" was RIGHT when written (March 26 — two days post-sunset),
but it MISSED the sunset/pivot news itself; the blog's "demand is not materializing /
ACP may evolve or be absorbed" coda was half-right (in-chat) and stale on the spec's
multi-PSP continuation. The fix = tell the full arc (which *reinforces* both pages'
thesis: consumer in-chat checkout stalled; machine payments are consolidating at the
M2M settlement layer — SettleGrid's core).

**Founder decisions (2026-06-04):**
1. **ACP stays on the roadmap** — facilitator-tier rail + BD line item (pursue
   OpenAI/Stripe onboarding if/when it re-opens). Coverage/credibility/optionality —
   NOT core revenue.
2. **This chunk = public-claims update + roadmap recording.** No kernel wiring.
3. **ACP-dark kernel wiring QUEUED** (scope = §4 of
   `p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md`), triggered when onboarding/BD
   is in motion — **with a new post-sunset PRE-CONDITION: re-verify the operative ACP
   payment flow before wiring** (the adapter's `validateAcpPayment` → Stripe
   `retrieveCheckoutSession` targets the SPT checkout-session model whose in-chat
   flagship was sunset 2026-03-24). The sunset retroactively validates not wiring now.
4. **B4 (accounts provisioning + `accountId` backfill) QUEUED** as the leading next
   real-settlement chunk (own Step-0 + full audit chain; too big to pair here).

**Step-0 also re-grounded the handoff §3 alternatives against actual code:**
- **B1 (legacy circle-nano tightening): already resolved** (2026-05-30 exhaustive
  round) — `proxy/[slug]/route.ts:1967` routes through
  `validateCircleNanoCredentialString`; the handoff's B1 text was stale.
- **B2 (repo-wide fire-and-forget durability): MOOT — the targets are dead-from-prod.**
  Every LIVE settlement-row write is already durable: `x402/orchestrate.ts:136` +
  `circle-nano/settle.ts:85` `await recordSettlementEntry` inline;
  `ap2/settle/route.ts:176` uses `after()`. The two named targets never fire in prod:
  `sessions.ts:469` (recordHop's write) is gated on `rail`/`protocol`/`accountId` that
  the ONLY prod caller (`api/sessions/[id]/hop/route.ts` zod schema, :13-20) never
  accepts; `postLedgerEntryAsync` has zero prod callers. Wrapping them in `after()`
  would change nothing live and would break recordHop's request-scope-free unit tests.
  **Discovered latent debt (non-money):** the multi-hop "per-hop settlement audit
  trail" therefore never fires in prod; fix = extend the hop route schema when
  multi-hop ledger attribution is wanted. JSONB budget accounting (authoritative)
  unaffected.

## 2. Scope — what shipped (IN)

- **A. state-of-mcp-2026 page** — the two ACP cells now carry the sunset/pivot facts
  the March snapshot missed; JSON-LD `dateModified` → 2026-06-04.
- **B. ai-agent-payment-protocols blog** — ACP table row + ACP section rewritten to
  the full arc; "ChatGPT plugin marketplace" → the post-pivot commerce-surface
  phrasing; a dated June-4 update banner (matching the existing April-2 convention);
  `dateModified` + update-history comment in `blog-posts.ts`.
- **C. P5 roadmap record** — "ACP — ROADMAP DECISION (2026-06-04)" section in
  `P5-kernel-dispatch-expansion-deferred.md` (gitignored-by-design local note, like
  the prior LANDED sections).
- **D. A1 debt-register addendum** — B4 queued; the latent hop-route gap noted.
- **E. This doc.**

## 3. ⚠️ SCOPE GUARD (held — verified by the scope lens + git diff)

- **NO settlement/kernel/SDK code.** Zero edits under `apps/web/src/lib/settlement/`,
  `apps/web/src/app/api/`, `packages/mcp/`.
- **NO capability-claim changes.** The "9 brokered / 2 detection / 3 emerging" honest
  framing, protocol counts, pill lists, README/llms.txt/mcp.json untouched
  (`honest-framing-regression.test.ts` green un-edited). Only ACP *market/adoption*
  statements changed.
- **NO other stale-cell fixes** on the state-of-mcp page (x402's "$28K/day" etc. were
  right-as-of-March; the page is a dated snapshot).
- The ACP protocol guide (`learn/protocols/[slug]`), llms-full.txt ACP section, and
  README ACP mentions carry capability descriptions, not market claims → untouched.
  The SDK adapter docstring ("Stripe-locked in v1") is internal and describes OUR v1
  implementation → left.
- The committed handoff doc is NOT rewritten (this doc records the Step-0 outcome).

## 4. The shipped copy (final, post-R1-correction + R2 precision pass)

**A1 — `learn/state-of-mcp-2026/page.tsx` volume table:** `Negligible` (restored —
it was accurate) / `In-chat checkout sunset March 24 (~12-30 merchants live); pivot
to discovery-first`.

**A2 — protocol-landscape table:** Backed By `OpenAI + Stripe`; Status `In-chat
checkout sunset March 24; spec continues (discovery-first pivot)`.

**B — blog:** June-4 banner (the original read held; sunset + pivot; spec alive and
broadening — "PayPal had signed on", R2 tense fix), ACP table row (`In-chat checkout
sunset Mar 2026; spec live, multi-PSP`), the ACP section rewritten as "2026's most
instructive case study" (announcements → few-dozen activation → sunset/pivot → spec
broadening → not an M2M rail; PayPal date split into its own Oct-2025 parenthetical —
R2 precision fix), and the recommendation line now says "discovery-first since the
March 2026 in-chat checkout sunset".

## 5. Fact base (final; every public claim sourced)

| # | Claim | Source(s) |
|---|---|---|
| F1 | ACP spec co-maintained by OpenAI + Stripe ("Founding Maintainers") | github.com/agentic-commerce-protocol · stripe.com/blog/developing-an-open-standard-for-agentic-commerce |
| F2 | Instant Checkout launched Sept 29, 2025, Etsy live | cnbc.com 2025-09-29 · digitalcommerce360.com 2025-09-30 · openai.com/index/buy-it-in-chatgpt |
| F3 | Feb 16, 2026 expansion ANNOUNCED: 1M+ Shopify slated (Glossier, SKIMS, Vuori) | digitalcommerce360.com/2026/02/16 |
| F4 | PayPal = ACP-compliant payment server (announced Oct 28, 2025; rollout 2026) | PayPal newsroom 2025-10-28 · techcrunch.com 2025-10-28 |
| F5 | Spec multi-PSP (PayPal, Checkout.com, Mollie, Worldpay, Worldline, Spreedly, FIS, Nexi) | stripe.com/blog/supporting-additional-payment-methods-for-agentic-commerce · acpready.com |
| F6 | Delegated Payment spec (SPTs = first implementation) | developers.openai.com/commerce/specs/payment · docs.stripe.com/agentic-commerce |
| F7 | Layer framing ACP/AP2/x402 | orium.com/blog/agentic-payments-acp-ap2-x402 · crossmint.com/learn/agentic-payments-protocols-compared |
| F8 | **March 24, 2026: in-chat Instant Checkout SUNSET; discovery-first pivot; merchants keep checkout; discovery model "powered by ACP"** | techcrunch.com/2026/03/24 · forrester.com ("leader in agentic commerce just pulled back") · retail-week.com · cnbc.com · digitalcommerce360.com |
| F9 | Only ~12–30 Shopify merchants ever activated | thekeyword.co (~12) · "fewer than 30" (TechCrunch/CNBC) · ecommercefastlane "Only 30" — copy says "~12-30" / "a few dozen" / "roughly a dozen" (all in envelope) |
| F10 | April 17, 2026 spec release: cart, feed, orders, authentication, MCP | github.com/agentic-commerce-protocol release 2026-04-17 |
| F11 | x402/MPP = the per-call machine-payment consolidation (x402 Foundation + Cloudflare/AWS/Stripe; MPP = Stripe+Tempo, Mar 18 2026, 50+ services) | blog.cloudflare.com/x402 · aws.amazon.com (Bedrock AgentCore) · mpp.dev · forrester.com |

Excluded from public copy (refuted / single-source / unverifiable): "largest merchant
distribution of any agentic-commerce protocol" (REFUTED vs AP2's 60+ partners + the
sunset), "1M+ began onboarding" (announced ≠ activated), the 4% Instant-Checkout fee,
the ~7× Cyber-Week figure, any GMV/day number.

## 6. Forced test edits

**None.** No test pins the old or new strings. `honest-framing-regression.test.ts`
constraints verified intact (canonical names preserved; no retired phrase introduced).

## 7. Verification record (the 3-part gate, adapted to a content chunk)

- **R1 fan-out (3 fresh-context lenses on the actual diff):**
  - *Fact-check lens* — **REFUTED the first-draft copy** (3 of 9 claims): surfaced the
    March-24 sunset (multi-source), the ~12–30 activation reality, and that the
    original page copy was right-when-written (the draft's "wrong when written"
    premise was inverted). All fixes applied → the copy now tells the three-act arc.
    This is the chunk's headline save; no test suite could have caught it.
  - *Scope/framing lens* — **PASS, 0 blocking**: only the 4 intended tracked files
    changed; zero settlement surface; honest-framing 37/37 green; no retired phrases;
    markdown table well-formed; 599 content tests green.
  - *Voice/completeness lens* — **COMPLETE** (the 3 files were the entire stale-claim
    blast radius; everything else is capability copy) + **VOICE-CLEAN** with one
    over-long table cell flagged → resolved by the R1 rewrite.
- **R2 fact-check (fresh agent, final copy): SAFE-TO-PUBLISH — YES.** 7 CONFIRMED /
  2 PARTIAL (PayPal tense + clause placement) / 0 REFUTED; both optional precision
  rewordings APPLIED ("PayPal had signed on"; the Oct-2025 parenthetical). Spot-checked
  live: the 2026-04-17 spec release, the ~12-30 range, "under ACP" (directly supported
  by TechCrunch/OpenAI quotes), x402/MPP consolidation.
- **Build gates (final copy):** recorded at commit — `tsc --noEmit` 0 · full `vitest`
  4220 pass / 1 known pre-existing fail (`processDataDeletion`) · `eslint` changed
  files 0 · `next build` exit 0 · `packages/mcp` untouched (SDK suite N/A — baseline
  1896 pass / 1 skip confirmed at pre-flight).
- **Funds SEAL: N/A** — no settlement surface in the diff (verified by the scope lens
  + git diff). Calibration deliberate: accuracy/framing rigor replaced the funds panel
  for a content-only chunk.
- **Post-build CERTIFICATION panel (founder-requested, 2026-06-04): ✅ CERTIFIED —
  0 blocking / 0 fix-now / 0 notes.** Dynamic workflow `wf_67d40dda-efd` (4
  fresh-context lenses → completeness critic → adversarial refuters, default-refuted,
  scope-expansion auto-reject) certified the COMMITTED artifact `df9a2477` byte-exact:
  *public-facts* (all 10 claim groups confirmed against live sources, both
  success- and failure-framed queries; the Mar-5 leak vs Mar-24 official-rollout
  nuance resolves in the copy's favor) · *code-claims* (all 10 internal-doc file:line
  claims re-derived clean against source; B2-moot reasoning confirmed — after()
  wrapping would be prod-inert AND break the request-scope-free unit tests) ·
  *consistency-voice* (one arc across every surface; render/format clean) ·
  *framing-scope* (commit = exactly 5 files off parent `9a9f866d`, zero
  settlement/api/SDK paths; honest-framing 37/37; retired-phrase + whole-surface
  completeness sweeps zero hits) · *critic* (JSON-LD valid; P5 doc correctly
  gitignored; commit MESSAGE itself fact-checked clean). The single candidate finding
  (`.audit/` untracked-but-not-gitignored — true, but repo-infra hygiene outside this
  chunk) was REJECTED as scope-expansion per the guard and surfaced to the founder as
  a separate follow-up. Full record: `.audit/acp-certification/` (local). This verdict
  is recorded as a follow-up commit so the certified tree is unchanged.

## 8. Out of scope / deferred (durably tagged)

- **B4 accounts provisioning + backfill** — QUEUED (leading next-settlement-chunk
  candidate; A1 register updated).
- **ACP-dark kernel wiring** — QUEUED, BD-gated, with the §1.3 post-sunset
  pre-condition.
- Hop-route schema extension (latent multi-hop ledger trail) — when multi-hop
  attribution is wanted.
- UCP verify-semantics research; Tier-2/3 rails; everything in handoff §12.
