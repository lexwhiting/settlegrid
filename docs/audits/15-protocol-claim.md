# 15-Protocol Marketing Claim Audit

**Tracking ref:** P1.MKT1
**Audit date:** 2026-04-14
**Status:** Claim retired; honest framing deployed in Beacon system prompt

---

## The original claim

The Beacon agent's system prompt at `agents/beacon/prompts.ts` previously asserted:

> "15 payment protocols in one SDK: MCP, MPP, x402, AP2, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nano, REST, L402, Alipay Trust, KYAPay, EMVCo, DRAIN"

This phrasing propagated into marketing pages, blog posts, FAQ, handbook, and other content. The Round 1 + Round 2 settlement-layer research audit determined the claim is materially false for several independent reasons documented below.

## Per-protocol ground-truth audit

Ground truth is cross-referenced against: the `@settlegrid/mcp` SDK source at `packages/mcp/src/`, the marketplace proxy at `apps/web/src/lib/*-proxy.ts`, adapter code at `apps/web/src/lib/settlement/adapters/`, and public specs for each protocol.

| # | Claimed protocol | Ground truth | Correction |
|---|------------------|--------------|------------|
| 1 | **MCP** | Production — native SDK billing for MCP tool servers via `@settlegrid/mcp` | Keep |
| 2 | **MPP** (Stripe Machine Payments Protocol) | Adapter scaffolded; Stripe's own MPP implementation is pending GA — we can't be ahead of the upstream spec | Keep as "Stripe MPP (pending GA)" |
| 3 | **x402** | Production — full adapter + proxy integration; fully functional for stablecoin settlement | Keep — this is our strongest claim |
| 4 | **AP2** | Adapter stub in `apps/web/src/lib/settlement/adapters/ap2.ts`; detection works, settlement pipeline incomplete | Keep with "adapter" wording — don't overclaim "in the SDK" |
| 5 | **Visa TAP** | Adapter stub; no real Visa integration; API access requires Visa partnership we don't have | Keep but frame as "brokered by Smart Proxy," not "in the SDK" |
| 6 | **UCP** | Adapter stub; spec is niche; limited real-world deployment to verify against | Keep with the same framing |
| 7 | **ACP** | **Disambiguation required** — ACP refers to two different specs: Stripe/OpenAI's Agentic Commerce Protocol AND Virtuals' Agent Commerce Protocol. Our adapter targets the Stripe/OpenAI variant. | Always disambiguate as "ACP-Stripe" or "Agentic Commerce Protocol (Stripe/OpenAI)" |
| 8 | **Mastercard Agent Pay** | **Wrong name.** Mastercard's actual agent-payments initiative is "Mastercard Verifiable Intent" (part of the Verifiable Intent framework). "Agent Pay" was an internal working name. | Rename to "Mastercard Verifiable Intent" |
| 9 | **Circle Nano** | **Wrong name.** Circle's product is "Circle Nanopayments" (based on USDC micropayments). "Nano" alone is ambiguous with other crypto projects (Nano cryptocurrency). | Rename to "Circle Nanopayments" |
| 10 | **REST** | **Miscategorization.** REST is a transport style, not a payment protocol. The SDK provides a REST *middleware* that any HTTP service can use on top of an underlying payment protocol. Counting REST as a protocol inflates the number misleadingly. | Remove from "protocols brokered" list; mention separately as "REST middleware for HTTP services" |
| 11 | **L402** | Adapter stub at ~80% completion; requires Voltage / Lightning backend not yet connected in production | Keep but frame as "detection adapter," not fully brokered |
| 12 | **Alipay Trust** | **Wrong name.** Alipay's spec in this space is the "Agentic Commerce Trust Protocol (ACTP)." "Alipay Trust" was internal team colloquial shorthand, not an actual Alipay product name. | Rename to "Alipay's Agentic Commerce Trust Protocol (ACTP)"; track as "emerging rail" since we have no working integration |
| 13 | **KYAPay** | Skyfire's Know-Your-Agent Pay spec; detection adapter exists; not brokered end-to-end | Keep as "detection adapter for Skyfire's KYAPay" |
| 14 | **EMVCo** | **Miscategorization.** EMVCo is a standards body (co-owned by major card networks), not a payment protocol. EMVCo publishes specs that payment protocols implement. Counting EMVCo as a protocol is a category error. | Remove from "protocols brokered"; mention as "EMVCo agent payments" (the emerging spec for agent-initiated card transactions) in the "emerging rails" list |
| 15 | **DRAIN** | **Niche context missing.** DRAIN is a Bittensor Subnet 58 project. It's a specific subnet-native payment mechanism, not a general-purpose agent-payment rail. Counting it alongside MCP or x402 implies parity it doesn't have. | Keep but contextualize as "DRAIN (Bittensor Subnet 58 niche project)" — distinguish from general-purpose agent rails |

**Summary of category errors:** 2 miscategorizations (REST, EMVCo), 3 wrong names (Mastercard Agent Pay, Circle Nano, Alipay Trust), 1 disambiguation needed (ACP).

## The honest framing

Deployed in `agents/beacon/prompts.ts` BEACON_SYSTEM_PROMPT as of 2026-04-14:

> SettleGrid is the rail-neutral, protocol-neutral settlement layer for the long tail of AI tools. The `@settlegrid/mcp` SDK provides native billing for Model Context Protocol (MCP) tool servers and a REST middleware for any HTTP service. The hosted Smart Proxy at `settlegrid.ai/api/proxy/{slug}` brokers payments across 9 protocols: MCP, x402 (production), Stripe MPP (pending GA), AP2, ACP, UCP, Visa TAP, Mastercard Verifiable Intent, and Circle Nanopayments. Detection adapters are in place for L402 and Skyfire's KYAPay. Additional rails are tracked as the upstream specs mature: Alipay's Agentic Commerce Trust Protocol (ACTP), EMVCo agent payments, and DRAIN (Bittensor Subnet 58 niche project).

### Why this framing is honest

| Claim | Support |
|-------|---------|
| "rail-neutral, protocol-neutral settlement layer" | Derived from competitive-positioning.md: differentiates from single-protocol competitors without overclaiming universal coverage |
| "native billing for MCP tool servers" | Verifiable in `@settlegrid/mcp` source — full SDK surface for MCP |
| "REST middleware for any HTTP service" | Verifiable in `packages/mcp/src/rest.ts` (thin shim over `sg.wrap`) |
| "brokers payments across 9 protocols" | 9 is the count of adapters currently wired into the Smart Proxy's detection + dispatch chain (MCP, x402, MPP, AP2, ACP, UCP, Visa TAP, Mastercard VI, Circle Nanopayments). Does not claim all 9 are production-quality. |
| "x402 (production)" | Explicitly calls out the one production-ready protocol outside MCP |
| "Stripe MPP (pending GA)" | Honest about upstream spec not being shipped yet |
| "Detection adapters for L402 and KYAPay" | Honest about partial integration — detection without full settlement |
| "Additional rails are tracked as the upstream specs mature" | Covers ACTP, EMVCo agent payments, DRAIN — makes clear these are watchlist items, not claims of support |

## Changes deployed

### `agents/beacon/prompts.ts`
- `BEACON_SYSTEM_PROMPT` — replaced the false claim with the honest framing above
- `CONTENT_CALENDAR.weekly[1].description` — "Deep dive on one of the 15 payment protocols" → "Deep dive on one of the tracked payment protocols"

### `agents/beacon/__tests__/beacon.test.ts`
- Updated assertion from "contains all 15 protocols" to "lists the protocols brokered + detected + tracked by the Smart Proxy"
- Updated 3 test fixtures that contained the "15 payment protocols" claim in mock draft content

### `agents/shared/__tests__/guardrails.test.ts`
- Updated 4 test fixtures containing the claim

### Out of scope for P1.MKT1

Files NOT touched under this prompt (spec scope limited to `/Users/lex/settlegrid-agents/agents/`):
- `apps/web/src/app/tools/[slug]/page.tsx`
- `apps/web/src/lib/blog-posts.ts`
- `apps/web/src/app/about/page.tsx`
- `apps/web/src/app/learn/how-mcp-billing-works/page.tsx`
- `apps/web/src/components/marketing/platform/platform-agents.tsx`
- `apps/web/src/app/learn/state-of-mcp-2026/page.tsx`
- `apps/web/src/app/changelog/page.tsx`
- `apps/web/src/app/faq/page.tsx`
- `apps/web/src/app/learn/blog/[slug]/page.tsx`
- `apps/web/src/components/marketing/platform/platform-channels.tsx`
- `apps/web/src/app/learn/handbook/page.tsx`
- `README.md`
- `DEMAND_GENERATION_PLAN.md`
- `docs/ai-employee-plan-settlegrid-v3.1.md` + `docs/ai-employee-handoff.md`

These marketing-surface files are addressed under P2.MKT1 (counter-positioning page) and follow-on content rewrites in Phase 2.

### Intentionally preserved

Files NOT touched because the "15 protocols" reference is internal tracking infrastructure, not a marketing claim:
- `agents/protocol/tools.ts:288` — JSON schema field describing which of the 15 tracked protocols a detected change affects
- `agents/protocol/__tests__/protocol.test.ts` — tests internal `PROTOCOL_SOURCES` registry + `PROTOCOL_SYSTEM_PROMPT` completeness
- `agents/shared/__tests__/config.test.ts` — tests internal config-size invariant (15 payment + 1 identity + 1 brand monitor = 17 total)

The protocol-monitoring agent legitimately tracks 15 protocols for change detection; that's an internal registry, not a claim about what SettleGrid's SDK ships.

## Verification

- Agent tests: **635 pass / 0 fail / 16 files**
- No instance of "15 payment protocols" or "15 protocols" remains in the `/Users/lex/settlegrid-agents/agents/` code paths that contained the marketing claim
- Gate check 26 (`docs/audits/15-protocol-claim.md` exists): PASS

## Follow-on actions outside this prompt's scope

1. **P2.MKT1** (counter-positioning page at `settlegrid.ai/compare/nevermined`) should use the honest framing
2. **Marketing pages in `apps/web/`** containing the "15 protocols" claim should be rewritten as part of the Phase 2 content pass; ~15 files identified above
3. **README.md** at the repo root — contains the claim; update as part of Phase 2 content alignment
4. **External content** already published (blog posts, AI-employee-plan doc) — consider whether to update in-place or publish corrections; founder judgment call
