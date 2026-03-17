# SettleGrid Strategic Blueprint: The Settlement Layer for the AI Economy

**Version**: 1.0
**Date**: March 16, 2026
**Classification**: Internal — Founder Strategy Document

---

## 1. Executive Summary

### 1.1 Vision

SettleGrid becomes the neutral settlement network for AI commerce — the "Visa of AI." Not a marketplace, not a billing platform, but the switching and settlement fabric that connects AI service providers, consumers, and agents across any protocol (MCP, x402, AP2, Visa TAP).

Every time an AI agent calls a tool, fetches data, delegates a subtask, or triggers a workflow — SettleGrid meters the operation, enforces the budget, splits the revenue, and settles the funds. Protocol-agnostic. Real-time. Non-custodial.

### 1.2 Current State

SettleGrid is the only purpose-built MCP monetization platform in existence. Production-ready infrastructure:

| Metric | Value |
|--------|-------|
| Tests | 832 (65 test files, 0 failures) |
| TypeScript errors | 0 |
| ESLint errors | 0 |
| API routes | 30+ |
| DB tables | 17 (developers, tools, consumers, consumerToolBalances, apiKeys, invocations, purchases, payouts, webhookEndpoints, webhookDeliveries, auditLogs, toolReviews, toolChangelogs, conversionEvents, consumerAlerts, toolHealthChecks, referrals, developerReputation, waitlistSignups) |
| SDK | @settlegrid/mcp — settlegrid.init() + wrap(), LRU cache, per-method pricing, 168 SDK tests |
| Metering | Redis DECRBY on hot path with PostgreSQL async writeback |
| Payouts | Stripe Connect Express |
| Fraud | 3-signal detection (rate spike, new-key high-value, rapid duplicate) |
| Auth | Clerk + API key hash + IP allowlisting (CIDR) |
| Observability | Webhooks (HMAC), audit logging, health checks, usage analytics |

**Repository**: `/Users/lex/settlegrid` (pnpm monorepo: `apps/web` + `packages/mcp`)
**Port**: 3005 | **Docker**: PG 5433, Redis 6380

### 1.3 The Pivot

**From**: "MCP payment layer" — a single-protocol monetization SDK for MCP tool servers
**To**: "Protocol-agnostic AI settlement network" — the clearing and settlement infrastructure for all AI-to-AI commerce

This is not a rewrite. It is a generalization. The existing MCP SDK, Redis metering, Stripe Connect payouts, fraud detection, and budget enforcement remain the core. We add protocol adapters (x402, AP2, Visa TAP), a double-entry ledger, workflow sessions with budget delegation, agent identity (KYA), and multi-rail disbursement (fiat + crypto).

### 1.4 Market Opportunity

| Data Point | Value | Source |
|------------|-------|--------|
| AI agents market | $7.6B (2025) to $183B (2033) | Markets & Markets, 49.6% CAGR |
| AI infrastructure | $101B (2026) to $203B (2031) | Gartner |
| Agentic commerce | $3-5T by 2030 | McKinsey |
| Institutions saying current systems cannot handle agent transactions | 85% | Visa/PYMNTS Survey 2025 |
| MCP servers monetized | <5% | SettleGrid analysis of MCP registry |
| MCP download growth | 85% MoM | Anthropic MCP ecosystem metrics |
| x402 transactions | 75.4M+ | Coinbase on-chain data |
| AP2 launch partners | 180+ | Google DeepMind announcement |

The gap: AI agents are proliferating, tools are being built, orchestration is maturing — but there is no settlement layer. Agents cannot pay other agents. Tool providers cannot meter usage in real-time. Multi-hop workflows have no way to split revenue. SettleGrid fills this gap.

### 1.5 Revenue Model (Target)

| Revenue Stream | Mechanism | Target Take Rate |
|----------------|-----------|-----------------|
| Transaction fees | Percentage of each settled operation | 2-5% (volume-tiered) |
| Platform subscription | Monthly fee for providers (analytics, advanced features) | $0 / $49 / $199 / custom |
| Netting premium | Batch settlement reduces Stripe/on-chain fees; share the savings | 50% of saved fees |
| Enterprise SLA | Dedicated infra, priority support, custom settlement windows | $999+/mo |
| Data products (future) | Anonymized settlement analytics, pricing intelligence | TBD |

---

## 2. Market Position & Competitive Landscape

### 2.1 The Layer Map (Where SettleGrid Lives)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 4: APPLICATIONS                                               │
│   AI Frameworks (OpenAI, LangChain, CrewAI, AutoGen)               │
│   Orchestrators (Claude MCP Client, Cursor, Windsurf)              │
│   Enterprise platforms (Salesforce, ServiceNow, SAP)               │
│   ─── ZERO native payment capability ───                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ Layer 3: DISCOVERY & ORCHESTRATION                                  │
│   MCP Registry / Server Cards (.well-known/mcp-server)             │
│   Skyfire Directory (agent discovery + KYA profiles)               │
│   AP2 Agent Discovery (Google agent-to-agent protocol)             │
│   Tool marketplaces (Composio, Toolhouse, etc.)                    │
│   ─── Knows WHAT exists, not HOW to pay ───                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ Layer 2: IDENTITY & TRUST                                           │
│   KYA: AgentFacts, Sumsub AI identity, Skyfire JWT                 │
│   AP2 Verifiable Digital Credentials (VDCs)                        │
│   Visa TAP agent tokens                                            │
│   x509 certificates, did:key identifiers                           │
│   ─── Knows WHO the agent is, not HOW to bill ───                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ Layer 1: SETTLEMENT   ◀◀◀◀◀ SETTLEGRID — THE GAP ▶▶▶▶▶            │
│   Real-time metering + budget enforcement                          │
│   Double-entry ledger + multi-party revenue split                  │
│   Workflow sessions with cascading budget delegation               │
│   Protocol-agnostic acceptance (MCP, x402, AP2, Visa TAP)         │
│   Netting engine + batch settlement                                │
│   ─── Connects identity to rails, enforces economics ───          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ Layer 0: PAYMENT RAILS                                              │
│   x402 / USDC on Base & Solana (crypto-native)                     │
│   Stripe / Cards / ACH / Wire (fiat)                               │
│   AP2 Card + Crypto rails (Google)                                 │
│   Visa TAP tokenized agent payments                                │
│   FedNow (real-time US settlement)                                 │
│   ─── Moves money, has NO context about the AI operation ───      │
└─────────────────────────────────────────────────────────────────────┘
```

**SettleGrid's position**: The only layer that understands both the AI operation (what method was called, how many tokens were consumed, which agents were in the chain) AND the financial settlement (who owes whom, how to enforce budgets in real-time, how to split multi-party revenue). Every other player is either above (applications, discovery, identity) or below (payment rails).

### 2.2 Competitive Matrix

#### 2.2.1 Billing Platforms (NOT Settlement)

These platforms meter usage and generate invoices. They do NOT enforce real-time budgets, do NOT understand MCP or agent protocols, and do NOT handle multi-party tool-chain settlement.

| Platform | Funding / Valuation | Pricing | Real-Time Enforcement | MCP SDK | Agent-to-Agent | Settlement |
|----------|---------------------|---------|----------------------|---------|----------------|------------|
| **Stripe + Metronome** (acquired Jan 2026) | $95B valuation | 2.9% + 30c (Stripe) + Metronome fees | NO — async metering only; Metronome processes events in batch; cannot enforce balance=0 -> reject on hot path | NO | NO | NO — billing only |
| **Orb** ($44M Series B) | $44M raised | $720/mo+ | NO — event-based; processes after the fact | NO | NO | NO |
| **Amberflo** (~$20M) | ~$20M raised | Usage-based | Partial — AI gateway can intercept but no budget enforcement | NO | NO | NO |
| **Lago** (OSS, 9.4K GitHub stars) | Open source | Free (self-host) / Cloud | NO — batch event processing | NO | NO | NO |
| **Togai** | $15M Series A | Usage-based | NO | NO | NO | NO |
| **Stigg** | $16M Series A | Feature-based | NO — feature flags, not metering | NO | NO | NO |
| **Zenskar** | $5M Seed | Contract-based | NO | NO | NO | NO |
| **m3ter** | $35M Series B | Usage-based | NO — async | NO | NO | NO |
| **OpenMeter** (OSS) | Open source | Free | NO — CloudEvents ingestion | NO | NO | NO |

**Why none of these are threats**: They solve billing (generating invoices from usage events). SettleGrid solves settlement (enforcing budgets in real-time, splitting multi-party revenue, handling multi-protocol acceptance). Billing is a solved problem. Settlement for AI agents is not.

#### 2.2.2 Agent Payment Platforms

| Platform | Funding | Focus | Real-Time | Protocol | Settlement | Key Weakness |
|----------|---------|-------|-----------|----------|------------|--------------|
| **Nevermined** | $4M | x402 facilitator | YES (on-chain) | x402 only | YES (on-chain) | 13 GitHub stars; Base-only; 1-6.5% fees; proprietary lock-in; no fiat settlement; no per-method pricing |
| **Paid.ai** | $21M seed | Cost attribution + billing | NO — attribution layer | Protocol-agnostic (observability) | NO — tracks costs, does not settle them | Not settlement infrastructure; observability only |
| **Catena Labs** | $18M | AI-native financial institution | Unknown (pre-product) | Stablecoin rails | YES (custody model) | Full financial institution = heavy regulation; not launched; custodial |
| **Natural** | $9.8M | B2B agent procurement | Unknown | Proprietary | Partial | Procurement != settlement; B2B only; no real-time metering |
| **Lava** | $5.8M | Single wallet for agents | Partial | Multi-chain | Partial | Wallet, not settlement network; no metering; no revenue split |
| **Skyfire** | $9.5M | Agent identity (KYA) + payment | YES (JWT claims) | JWT-based proprietary | YES | Identity-first, not settlement-first; JWT lock-in; proprietary protocol |

**Key insight**: Nevermined is the closest competitor in the x402 space. Skyfire is the closest in identity + payment. Neither has SettleGrid's combination of: (a) synchronous Redis metering, (b) per-method pricing, (c) MCP-native SDK, (d) fiat settlement via Stripe Connect, (e) protocol-agnostic design. By building x402 facilitator support (Phase 1), SettleGrid becomes a superset of Nevermined. By implementing AgentFacts-compatible KYA (Phase 3), SettleGrid complements rather than competes with Skyfire.

#### 2.2.3 Protocol-Level Standards

| Standard | Maintainer | Status | Transactions | Key Features | What's Missing |
|----------|-----------|--------|-------------|--------------|----------------|
| **x402** | Coinbase | v2 spec, 5.7K GitHub stars | 75.4M+ | HTTP 402 status, EIP-3009/Permit2, facilitator model, receipts | No session/budget support; no multi-hop chains; no fiat; no per-method pricing; no SDK |
| **AP2** (Agent-to-Agent Protocol) | Google DeepMind | v0.1, 180+ partners | Pre-launch | VDCs, umbrella orchestration, card + crypto rails, cross-platform agent discovery | v0.1 — not production; cards via existing processors; no real-time budget enforcement |
| **Visa TAP** | Visa | Restricted pilot | Unknown | Tokenized agent payments, Visa network settlement, pre-authorized spending controls | Restricted to Visa network; no crypto; no open protocol; requires Visa partnership |
| **MCP** | Anthropic | 1.0 GA | N/A (tool protocol) | Tool calling, resources, prompts, sampling | ZERO payment capability (experimental.payment proposed but not implemented) |

**Key insight**: These are protocols, not products. x402 defines HOW to pay with crypto but not WHO manages the session, budget, or ledger. AP2 defines HOW agents discover and authenticate each other but delegates payment to existing processors. Visa TAP defines HOW to authorize agent spending within the Visa network. SettleGrid implements the settlement logic ON TOP of any of these protocols.

### 2.3 SettleGrid's 7 Structural Advantages

SettleGrid is the ONLY product that combines all seven capabilities:

| # | Capability | SettleGrid | Stripe+Metronome | Orb | Nevermined | Skyfire | Paid.ai |
|---|-----------|------------|-------------------|-----|------------|---------|---------|
| 1 | **Synchronous real-time metering** (Redis DECRBY on hot path — balance=0 rejects instantly) | YES | NO (async batch) | NO | YES (on-chain, slow) | YES (JWT claims) | NO |
| 2 | **MCP-native SDK** (`settlegrid.wrap()` — 3 lines to monetize any MCP tool) | YES | NO | NO | NO | NO | NO |
| 3 | **Per-method pricing** (different cost for `search` vs `analyze` vs `generate`) | YES | Partial (dimensions) | YES | NO (flat per-request) | NO | NO |
| 4 | **Budget enforcement with auto-402** (consumer sets $50/month, system enforces) | YES | NO | NO | NO | Partial | NO |
| 5 | **Fiat settlement via Stripe Connect** (developers get paid to their bank account) | YES | YES (Stripe itself) | NO | NO (crypto only) | YES | NO |
| 6 | **Protocol-agnostic design** (MCP today, x402/AP2/TAP via adapter interface) | PLANNED | NO | NO | x402 only | Proprietary JWT | NO |
| 7 | **Multi-party tool chain settlement** (A calls B calls C — revenue splits automatically) | PLANNED | NO | NO | NO | NO | NO |

### 2.4 Stripe Threat Assessment

Stripe acquired Metronome (usage billing) in January 2026. This is the most credible threat to SettleGrid's position. Assessment:

**7 Structural Gaps Stripe Cannot Close Quickly:**

1. **Async metering only**: Metronome processes usage events asynchronously. It cannot do `if (balance < cost) return 402` on the hot path. SettleGrid's Redis DECRBY enforces this in <1ms. Stripe would need to build a distributed balance cache — that's a new product, not a feature of Metronome.

2. **No MCP developer monetization SDK**: Stripe has no SDK that wraps an MCP tool handler with 3 lines of code. Building `settlegrid.wrap()` equivalent requires understanding the MCP protocol, _meta payment context, and tool invocation lifecycle. This is domain expertise Stripe does not have.

3. **No per-method pricing**: Stripe bills by "dimension" (e.g., API calls, storage, compute). This is close but not the same as per-METHOD pricing where `tool.search` costs 5 cents and `tool.analyze` costs 50 cents within the same tool. Metronome's model is oriented toward SaaS meters, not AI tool methods.

4. **No budget enforcement with auto-402**: Stripe does not enforce spending limits on API consumers in real-time. Metronome tracks usage and generates invoices; it does not gate access when a budget is exhausted. SettleGrid returns HTTP 402 with a top-up URL the instant a consumer's balance hits zero.

5. **No multi-party tool chain settlement**: When Agent A calls Tool B which calls Tool C, the revenue must be split 3 ways in a single atomic operation. Stripe Connect can do marketplace splits, but only with pre-defined relationships. SettleGrid's planned workflow sessions handle dynamic chains with cascading budget delegation.

6. **No MCP billing protocol**: There is no MCP standard for communicating pricing, balance, or payment requirements between client and server. SettleGrid is drafting the MCP SEP (Standards Enhancement Proposal) for `experimental.payment` capability. Stripe has no presence in MCP standardization.

7. **No developer marketplace with discovery**: Stripe does not help developers find consumers or consumers find tools. SettleGrid's directory, reviews, reputation scores, and referral system create a network effect that billing infrastructure cannot replicate.

**SettleGrid's Stripe Strategy: Complement, Don't Compete.**

SettleGrid is BUILT ON Stripe Connect for fiat payouts. This is a feature, not a dependency:
- Stripe is Layer 0 (payment rail). SettleGrid is Layer 1 (settlement logic).
- If Stripe built a settlement layer, it would take 2-3 years and would be Stripe-only. SettleGrid is protocol-agnostic and can route to crypto rails too.
- Stripe's incentive is to process MORE transactions. SettleGrid's netting engine reduces the number of Stripe transactions (batch settlement). This is a tension point, but SettleGrid's volume growth offsets it.
- Best outcome: Stripe partners with or acquires SettleGrid as their AI settlement layer (this is the "Visa of AI" endgame).

### 2.5 Positioning Statement

**Category**: AI Settlement Infrastructure
**Initial Wedge**: MCP Monetization (sole occupant of this category)
**Expansion Path**: MCP -> x402 -> AP2 -> Visa TAP -> all agent protocols

**One-liner**: "Stripe is for billing humans. SettleGrid is for billing agents."

**Elevator pitch**: "SettleGrid is the settlement layer for the AI economy. Today, we're the only platform that lets developers monetize MCP tools with 3 lines of code. Tomorrow, we'll settle every AI agent transaction — across any protocol, in any currency, in real-time."

**For developers**: "Add `settlegrid.wrap(handler)` to your MCP tool. We handle metering, billing, fraud detection, and payouts. You keep 85%."

**For enterprises**: "SettleGrid gives your AI agents a spending budget. No more runaway costs. Real-time enforcement, full audit trail, per-tool analytics."

**For investors**: "85% of financial institutions say they can't handle autonomous agent transactions. SettleGrid is the clearing and settlement infrastructure they need. Built on Stripe Connect, interoperable with x402 and AP2, already in production."

---

## 3. Architecture Vision

### 3.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PROTOCOL LAYER                                │
│                                                                      │
│   MCP _meta           x402 HTTP 402       AP2 VDCs      Visa TAP    │
│   (settlegrid-api-key (PAYMENT-SIGNATURE  (payment      (tokenized  │
│    in metadata)        header, EIP-712)    credentials)   auth)      │
│                                                                      │
└───────┬───────────────────┬──────────────────┬──────────────┬───────┘
        │                   │                  │              │
┌───────▼───────────────────▼──────────────────▼──────────────▼───────┐
│                     ACCEPTANCE GATEWAY                                │
│                                                                      │
│   ProtocolAdapter.extractPaymentContext(request) → PaymentContext     │
│   ProtocolAdapter.formatResponse(result) → Response                  │
│                                                                      │
│   PaymentContext: {                                                   │
│     protocol: 'mcp' | 'x402' | 'ap2' | 'visa-tap'                  │
│     identity: { type: 'api-key' | 'did' | 'jwt' | 'tap-token',     │
│                 value: string, metadata?: Record<string, unknown> }  │
│     operation: { service: string, method: string, params?: unknown } │
│     payment: { type: 'credit-balance' | 'eip3009' | 'permit2'       │
│                      | 'card-token' | 'vdc',                        │
│                amount?: { value: bigint, currency: string },         │
│                proof?: string }                                      │
│     session?: { id: string, budgetCents: number }                   │
│   }                                                                  │
│                                                                      │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                     SETTLEMENT ENGINE                                │
│                                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │   Identity    │  │   Metering   │  │    Budget    │             │
│   │    (KYA)      │  │   (Redis)    │  │   Enforce    │             │
│   │              │  │              │  │              │             │
│   │ Resolve agent │  │ DECRBY hot   │  │ Session +    │             │
│   │ identity from │  │ path, async  │  │ period +     │             │
│   │ any protocol  │  │ DB writeback │  │ delegation   │             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │    Fraud     │  │   Workflow   │  │   Ledger     │             │
│   │   Detect     │  │   Sessions   │  │   (D.E.)     │             │
│   │              │  │              │  │              │             │
│   │ Rate spike,  │  │ Parent/child │  │ Immutable    │             │
│   │ new-key,     │  │ delegation,  │  │ double-entry │             │
│   │ rapid-dupe   │  │ rollup       │  │ in PostgreSQL│             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │  Analytics   │  │   Webhook    │  │  Pricing     │             │
│   │              │  │   Events     │  │  Engine      │             │
│   │ Revenue,     │  │              │  │              │             │
│   │ usage,       │  │ HMAC-signed  │  │ Per-method,  │             │
│   │ performance  │  │ delivery +   │  │ tiered,      │             │
│   │ per-protocol │  │ retry        │  │ outcome      │             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                    DISBURSEMENT LAYER                                 │
│                                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │Stripe Connect│  │ USDC On-Chain│  │   Netting    │             │
│   │(fiat payouts)│  │(Base/Solana) │  │   Engine     │             │
│   │              │  │              │  │              │             │
│   │ Express      │  │ EIP-3009     │  │ Aggregate    │             │
│   │ accounts,    │  │ transfers,   │  │ debits and   │             │
│   │ bank deposit │  │ facilitator  │  │ credits,     │             │
│   │              │  │ settlement   │  │ settle net   │             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Architectural Principles

**Principle 1: Ledger Is the Source of Truth**

Every financial mutation in SettleGrid produces balanced double-entry ledger records in PostgreSQL. Balances are derived from the sum of ledger entries, never stored directly (except as cached materialized views in Redis for the hot path). The ledger is append-only and immutable — corrections are made via compensating entries, never updates.

Current state: Balance is a mutable `balanceCents` integer on `consumerToolBalances`. Revenue share is computed inline in the meter route.
Target state: `ledgerEntries` table with debit/credit pairs. `accounts` table with `balanceCents` as a materialized cache with `version` for optimistic locking. All balance changes go through a `postLedgerEntry()` function that atomically creates the entry and updates the account cache.

**Principle 2: Synchronous Hot Path, Asynchronous Settlement**

The metering hot path (validate key -> check balance -> deduct -> respond) must complete in <10ms p99. Redis DECRBY handles balance enforcement. Everything else (DB writeback, ledger entries, webhook dispatch, analytics) is fire-and-forget.

Current state: This is already implemented. `deductCreditsRedis()` in `/Users/lex/settlegrid/apps/web/src/lib/metering.ts` uses Redis DECRBY with DB fallback. `recordInvocationAsync()` does fire-and-forget DB writes.
Target state: Same pattern, extended to all protocols. The `SettlementEngine.settle()` function returns immediately after Redis deduction. A background job reconciles Redis with the ledger.

**Principle 3: Protocol-Agnostic Acceptance**

Every supported protocol (MCP, x402, AP2, Visa TAP) has a `ProtocolAdapter` that normalizes the incoming request into a `PaymentContext` and formats the settlement result into the protocol-appropriate response. The settlement engine never knows which protocol originated the request.

Current state: MCP-specific. API key extraction is hardcoded in `packages/mcp/src/middleware.ts` (`extractApiKey` function reads `settlegrid-api-key` from MCP metadata or `x-api-key` header).
Target state: `ProtocolAdapter` interface with `MCPAdapter`, `X402Adapter`, `AP2Adapter`, `VisaTAPAdapter` implementations. Protocol detection from request headers/content. Automatic routing.

**Principle 4: Multi-Rail Disbursement**

Providers choose how they get paid: fiat (Stripe Connect), crypto (USDC on Base/Solana), or both. The disbursement layer routes based on provider preference. SettleGrid never custodies funds — Stripe holds fiat, smart contracts hold crypto.

Current state: Stripe Connect Express only. Payouts in `/Users/lex/settlegrid/apps/web/src/app/api/payouts/` route to Stripe.
Target state: `DisbursementRouter` that checks provider's `payoutRail` preference (fiat/crypto/split) and routes accordingly.

**Principle 5: Credit-Based Model with Netting**

Consumers pre-fund balances (buy credits via Stripe Checkout). This avoids per-transaction payment processing fees. Periodic netting aggregates credits and debits across providers, reducing Stripe transfer count and fees.

Current state: Credit-based model exists. Consumers buy credits via `purchases` table + Stripe Checkout. No netting — each payout is a separate Stripe transfer.
Target state: `settlementBatches` table aggregates operations per provider per settlement window (daily/weekly). A single Stripe transfer covers the net amount. For high-volume providers, netting can reduce Stripe fees by 60-80%.

**Principle 6: Never Custody Funds**

SettleGrid is an accounting and settlement orchestration layer. Fiat funds flow through Stripe (consumer -> Stripe -> provider's bank). Crypto funds flow through on-chain smart contracts (consumer's wallet -> x402 facilitator contract -> provider's wallet). SettleGrid records the transactions but never holds the money. This avoids money transmitter regulations in most jurisdictions.

Current state: Already non-custodial via Stripe Connect.
Target state: Extend non-custodial model to crypto via x402 facilitator pattern (SettleGrid verifies and submits settlement transactions but funds flow directly on-chain).

### 3.3 Data Model Evolution

#### 3.3.1 Current Schema (17 Tables)

Located at `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts`:

```
developers              — Provider accounts (email, tier, Stripe Connect, balance)
tools                   — Services/tools registered by developers (slug, pricing, stats)
consumers               — Customer accounts (email, Stripe customer)
consumerToolBalances    — Per-tool credit balances + budget controls
apiKeys                 — Consumer API keys per tool (hash, IP allowlist, test mode)
invocations             — Usage records (tool, consumer, method, cost, latency)
purchases               — Credit purchase records (Stripe session/payment intent)
payouts                 — Developer payout records (Stripe transfer)
webhookEndpoints        — Developer webhook subscriptions
webhookDeliveries       — Webhook delivery attempts + retry tracking
auditLogs               — System audit trail
toolReviews             — Consumer ratings + comments
toolChangelogs          — Tool version history
conversionEvents        — Funnel tracking (trial, upgrade, churn)
consumerAlerts          — Balance/budget/usage alert rules
toolHealthChecks        — Tool uptime monitoring records
referrals               — Developer-to-developer referral tracking
developerReputation     — Computed reputation scores
waitlistSignups         — Pre-launch waitlist
```

#### 3.3.2 Target Schema Additions (7 New Tables)

**Table: `accounts`** — Unified financial account for any entity (provider, customer, platform, escrow)

```typescript
// File: /Users/lex/settlegrid/apps/web/src/lib/db/schema.ts

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(), // 'provider' | 'customer' | 'platform' | 'escrow'
    entityId: uuid('entity_id').notNull(), // references developers.id, consumers.id, or synthetic
    entityType: text('entity_type').notNull(), // 'developer' | 'consumer' | 'system'
    currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
    balanceCents: integer('balance_cents').notNull().default(0),
    pendingDebitCents: integer('pending_debit_cents').notNull().default(0),
    pendingCreditCents: integer('pending_credit_cents').notNull().default(0),
    version: integer('version').notNull().default(1), // optimistic locking
    status: text('status').notNull().default('active'), // 'active' | 'frozen' | 'closed'
    metadata: jsonb('metadata'), // extensible
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('accounts_entity_currency_idx').on(table.entityId, table.entityType, table.currencyCode),
    index('accounts_type_idx').on(table.type),
    index('accounts_status_idx').on(table.status),
  ]
)
```

**Table: `ledgerEntries`** — Immutable double-entry ledger

```typescript
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }), // never delete an account with entries
    entryType: text('entry_type').notNull(), // 'debit' | 'credit'
    amountCents: integer('amount_cents').notNull(), // always positive
    currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
    operationId: uuid('operation_id'), // links to the operation (invocation) that caused this entry
    batchId: uuid('batch_id'), // links to settlementBatches for netting
    category: text('category').notNull(), // 'metering' | 'purchase' | 'payout' | 'refund' | 'fee' | 'netting'
    counterpartyAccountId: uuid('counterparty_account_id')
      .references(() => accounts.id), // the other side of the double entry
    description: text('description'),
    metadata: jsonb('metadata'), // protocol, method, session, etc.
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ledger_entries_account_id_idx').on(table.accountId),
    index('ledger_entries_operation_id_idx').on(table.operationId),
    index('ledger_entries_batch_id_idx').on(table.batchId),
    index('ledger_entries_category_idx').on(table.category),
    index('ledger_entries_created_at_idx').on(table.createdAt),
    index('ledger_entries_account_created_idx').on(table.accountId, table.createdAt),
  ]
)
```

**Table: `workflowSessions`** — Budget-scoped execution contexts

```typescript
export const workflowSessions = pgTable(
  'workflow_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    parentSessionId: uuid('parent_session_id')
      .references((): AnyPgColumn => workflowSessions.id), // self-reference for nesting
    budgetCents: integer('budget_cents').notNull(),
    spentCents: integer('spent_cents').notNull().default(0),
    reservedCents: integer('reserved_cents').notNull().default(0), // delegated to child sessions
    status: text('status').notNull().default('active'), // 'active' | 'completed' | 'expired' | 'cancelled'
    protocol: text('protocol'), // 'mcp' | 'x402' | 'ap2' | 'visa-tap' | null (any)
    metadata: jsonb('metadata'), // workflow name, agent chain, etc.
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workflow_sessions_customer_id_idx').on(table.customerId),
    index('workflow_sessions_parent_id_idx').on(table.parentSessionId),
    index('workflow_sessions_status_idx').on(table.status),
    index('workflow_sessions_expires_at_idx').on(table.expiresAt),
  ]
)
```

**Table: `agentIdentities`** — KYA (Know Your Agent) identity records

```typescript
export const agentIdentities = pgTable(
  'agent_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .references(() => developers.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(),
    identityType: text('identity_type').notNull(), // 'api-key' | 'did:key' | 'jwt' | 'x509' | 'tap-token'
    publicKey: text('public_key'), // Ed25519 public key (hex) for did:key, or null
    fingerprint: text('fingerprint').unique(), // SHA-256 of the identity proof
    verificationLevel: text('verification_level').notNull().default('none'),
      // 'none' | 'basic' (email verified) | 'business' (domain verified) | 'individual' (KYC)
    agentFactsProfile: jsonb('agent_facts_profile'), // AgentFacts JSON (4 categories)
    capabilities: jsonb('capabilities'), // { tools: string[], methods: string[], pricing: PricingConfig }
    spendingLimitCents: integer('spending_limit_cents'), // max spend per session
    status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'revoked'
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('agent_identities_provider_id_idx').on(table.providerId),
    index('agent_identities_identity_type_idx').on(table.identityType),
    index('agent_identities_status_idx').on(table.status),
    uniqueIndex('agent_identities_fingerprint_idx').on(table.fingerprint),
  ]
)
```

**Table: `settlementBatches`** — Netting and batch settlement records

```typescript
export const settlementBatches = pgTable(
  'settlement_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    grossRevenueCents: integer('gross_revenue_cents').notNull().default(0),
    platformFeeCents: integer('platform_fee_cents').notNull().default(0),
    netPayoutCents: integer('net_payout_cents').notNull().default(0),
    operationCount: integer('operation_count').notNull().default(0),
    payoutRail: text('payout_rail').notNull().default('stripe'), // 'stripe' | 'usdc-base' | 'usdc-solana'
    payoutReference: text('payout_reference'), // Stripe transfer ID or on-chain tx hash
    status: text('status').notNull().default('pending'),
      // 'pending' | 'processing' | 'settled' | 'failed'
    failureReason: text('failure_reason'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('settlement_batches_provider_id_idx').on(table.providerId),
    index('settlement_batches_status_idx').on(table.status),
    index('settlement_batches_period_idx').on(table.periodStart, table.periodEnd),
  ]
)
```

**Table: `paymentRails`** — Configured payment rails per provider

```typescript
export const paymentRails = pgTable(
  'payment_rails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    railType: text('rail_type').notNull(), // 'stripe' | 'usdc-base' | 'usdc-solana'
    isPrimary: boolean('is_primary').notNull().default(false),
    config: jsonb('config').notNull(), // rail-specific: { stripeConnectId } or { walletAddress, chainId }
    status: text('status').notNull().default('active'), // 'active' | 'pending' | 'disabled'
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('payment_rails_provider_id_idx').on(table.providerId),
    uniqueIndex('payment_rails_provider_type_idx').on(table.providerId, table.railType),
  ]
)
```

**Table: `protocolAdapters`** — Registered protocol adapter configurations

```typescript
export const protocolAdapters = pgTable(
  'protocol_adapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    protocol: text('protocol').notNull().unique(), // 'mcp' | 'x402' | 'ap2' | 'visa-tap'
    displayName: text('display_name').notNull(),
    status: text('status').notNull().default('active'), // 'active' | 'beta' | 'disabled'
    config: jsonb('config'), // protocol-specific configuration
    supportedRails: jsonb('supported_rails').notNull().default('["stripe"]'),
      // which payment rails this protocol supports: ['stripe', 'usdc-base', 'usdc-solana']
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
)
```

#### 3.3.3 Existing Table Modifications

**Rename Strategy**: We use SQL views for backward compatibility rather than renaming tables, to avoid breaking existing API routes during the transition.

```sql
-- Phase 0 migration: Create views with new names pointing to existing tables
CREATE VIEW providers AS SELECT * FROM developers;
CREATE VIEW services AS SELECT * FROM tools;
CREATE VIEW customers AS SELECT * FROM consumers;
CREATE VIEW operations AS SELECT * FROM invocations;
```

In TypeScript, create type aliases in a new file `/Users/lex/settlegrid/apps/web/src/lib/db/aliases.ts`:

```typescript
// Backward-compatible aliases for the generalized naming
export {
  developers as providers,
  tools as services,
  consumers as customers,
  invocations as operations,
} from './schema'

// New types for the generalized model
export type Provider = typeof import('./schema').developers.$inferSelect
export type Service = typeof import('./schema').tools.$inferSelect
export type Customer = typeof import('./schema').consumers.$inferSelect
export type Operation = typeof import('./schema').invocations.$inferSelect
```

**`tools` table additions** (add columns, don't rename table yet):

```typescript
// Add to existing tools table definition:
protocol: text('protocol').default('mcp'), // 'mcp' | 'x402' | 'ap2' | 'any'
unitType: text('unit_type').default('invocation'), // 'invocation' | 'token' | 'byte' | 'second'
currencyCode: varchar('currency_code', { length: 3 }).default('USD'),
```

**`invocations` table additions**:

```typescript
// Add to existing invocations table definition:
protocol: text('protocol').default('mcp'), // which protocol originated this operation
sessionId: text('session_id'), // already exists — reuse for workflow sessions
accountId: uuid('account_id'), // link to accounts table for ledger
```

### 3.4 Internal Type System

Create a new file at `/Users/lex/settlegrid/apps/web/src/lib/settlement/types.ts`:

```typescript
/**
 * Core settlement types — protocol-agnostic
 * All protocols normalize to these types before reaching the settlement engine.
 */

// ─── Payment Context (normalized from any protocol) ──────────────────────────

export type ProtocolName = 'mcp' | 'x402' | 'ap2' | 'visa-tap'

export type IdentityType = 'api-key' | 'did:key' | 'jwt' | 'x509' | 'tap-token'

export type PaymentType =
  | 'credit-balance'    // Pre-funded SettleGrid credits (existing model)
  | 'eip3009'           // x402 exact scheme (EIP-3009 transferWithAuthorization)
  | 'permit2'           // x402 upto scheme (Permit2 permitWitnessTransferFrom)
  | 'card-token'        // AP2/Visa TAP tokenized card
  | 'vdc'               // AP2 Verifiable Digital Credential

export interface PaymentContext {
  protocol: ProtocolName
  identity: {
    type: IdentityType
    value: string           // API key, DID, JWT, cert fingerprint, TAP token
    metadata?: Record<string, unknown>
  }
  operation: {
    service: string         // tool slug or service identifier
    method: string          // method name within the service
    params?: unknown        // operation parameters (for logging/analytics, not billing)
  }
  payment: {
    type: PaymentType
    amount?: {
      value: bigint         // amount in smallest unit (cents for USD, wei for ETH)
      currency: string      // 'USD' | 'USDC' | etc.
    }
    proof?: string          // EIP-712 signature, JWT, etc.
    maxAmount?: {
      value: bigint
      currency: string
    }
  }
  session?: {
    id: string
    parentId?: string
  }
  requestId: string         // idempotency key
}

// ─── Settlement Result ───────────────────────────────────────────────────────

export type SettlementStatus =
  | 'settled'           // Operation completed and funds moved
  | 'pending'           // Operation recorded, settlement deferred (netting)
  | 'rejected'          // Insufficient funds, budget exceeded, or fraud
  | 'failed'            // System error during settlement

export interface SettlementResult {
  status: SettlementStatus
  operationId: string       // UUID of the recorded operation
  costCents: number         // actual cost charged
  remainingBalanceCents?: number  // for credit-balance payments
  txHash?: string           // for on-chain settlements
  receipt?: string          // signed receipt (x402 offer-and-receipt)
  error?: {
    code: string            // machine-readable error code
    message: string         // human-readable error message
    retryable: boolean
  }
  metadata: {
    protocol: ProtocolName
    latencyMs: number
    settlementType: 'real-time' | 'batched'
  }
}

// ─── Protocol Adapter Interface ──────────────────────────────────────────────

export interface ProtocolAdapter {
  /** Protocol identifier */
  readonly name: ProtocolName

  /** Human-readable display name */
  readonly displayName: string

  /** Detect if this adapter should handle the request */
  canHandle(request: Request): boolean

  /** Extract payment context from protocol-specific request */
  extractPaymentContext(request: Request): Promise<PaymentContext>

  /** Format settlement result into protocol-specific response */
  formatResponse(result: SettlementResult, request: Request): Response

  /** Format error into protocol-specific error response */
  formatError(error: Error, request: Request): Response
}

// ─── Pricing Model (generalized) ────────────────────────────────────────────

export type PricingModel =
  | 'per-invocation'    // fixed cost per call (current model)
  | 'per-token'         // cost per token (LLM proxies)
  | 'per-byte'          // cost per byte transferred (data services)
  | 'per-second'        // cost per second of compute (long-running tasks)
  | 'tiered'            // volume-based tiers
  | 'outcome'           // pay only on successful outcome

export interface GeneralizedPricingConfig {
  model: PricingModel
  defaultCostCents: number
  currencyCode: string  // 'USD' default
  methods?: Record<string, {
    costCents: number
    unitType?: string   // override unit type per method
    displayName?: string
  }>
  tiers?: Array<{
    upTo: number        // number of units in this tier
    costCents: number   // cost per unit in this tier
  }>
  outcomeConfig?: {
    successCostCents: number
    failureCostCents: number  // usually 0
    successCondition: string  // JSONPath or simple field check
  }
}

// ─── Session & Budget Delegation ─────────────────────────────────────────────

export interface SessionCreateParams {
  customerId: string
  budgetCents: number
  expiresIn?: number        // seconds; default 3600 (1 hour)
  parentSessionId?: string  // for delegation
  protocol?: ProtocolName   // restrict to specific protocol
  metadata?: Record<string, unknown>
}

export interface SessionDelegateParams {
  sessionId: string
  budgetCents: number       // must be <= parent's remaining budget
  agentId: string           // agent identity receiving the delegation
  expiresIn?: number        // must be <= parent's remaining TTL
  metadata?: Record<string, unknown>
}

export interface SessionState {
  id: string
  customerId: string
  parentSessionId: string | null
  budgetCents: number
  spentCents: number
  reservedCents: number     // delegated to children
  availableCents: number    // budget - spent - reserved
  status: 'active' | 'completed' | 'expired' | 'cancelled'
  expiresAt: string | null
  children: SessionState[]  // recursive child sessions
}

// ─── Agent Identity (KYA) ────────────────────────────────────────────────────

export interface AgentFactsProfile {
  /** Category 1: Core Identity */
  coreIdentity: {
    id: string              // SettleGrid agent ID or DID
    name: string
    version: string
    provider: string        // developer/provider name
    ttl: number             // seconds until profile refresh
  }
  /** Category 2: Capabilities */
  capabilities: {
    tools: string[]         // tool slugs this agent can access
    methods: string[]       // methods within tools
    pricing: GeneralizedPricingConfig
    protocols: ProtocolName[]
  }
  /** Category 3: Authentication & Permissions */
  authPermissions: {
    authTypes: IdentityType[]
    rateLimits: { requestsPerMinute: number; requestsPerDay: number }
    spendingLimits: { perSession: number; perDay: number; currency: string }
  }
  /** Category 4: Verification */
  verification: {
    level: 'none' | 'basic' | 'business' | 'individual'
    verifiedAt?: string     // ISO timestamp
    signature?: string      // Ed25519 signature over the profile
    trustScore: number      // 0-100, computed from history
  }
}
```

---

## 4. Phased Implementation Plan

### Phase 0: Foundation Refactor (2 weeks)

**Goal**: Generalize the codebase from MCP-specific to protocol-agnostic without breaking existing functionality. Every existing test must continue passing. All new code must have tests.

**Success criteria**:
- All 832 existing tests pass
- New tables created with migrations
- Generalized pricing model works for per-invocation (backward compatible)
- Double-entry ledger records all operations
- Protocol adapter interface defined with MCPAdapter as first implementation
- Workflow session CRUD API working
- 50+ new tests covering ledger, sessions, and adapter interface

---

#### Phase 0.1: Create Generalized Type System

**Files to create:**

1. `/Users/lex/settlegrid/apps/web/src/lib/settlement/types.ts` — Core settlement types (as defined in section 3.4 above)

2. `/Users/lex/settlegrid/apps/web/src/lib/settlement/index.ts` — Public exports

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/index.ts
export * from './types'
export * from './engine'
export * from './adapters'
export * from './ledger'
export * from './sessions'
```

3. `/Users/lex/settlegrid/apps/web/src/lib/settlement/adapters/index.ts` — Adapter registry

```typescript
import type { ProtocolAdapter, ProtocolName } from '../types'

class ProtocolRegistry {
  private adapters = new Map<ProtocolName, ProtocolAdapter>()

  register(adapter: ProtocolAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter already registered for protocol: ${adapter.name}`)
    }
    this.adapters.set(adapter.name, adapter)
  }

  get(name: ProtocolName): ProtocolAdapter | undefined {
    return this.adapters.get(name)
  }

  detect(request: Request): ProtocolAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(request)) {
        return adapter
      }
    }
    return undefined
  }

  list(): ProtocolAdapter[] {
    return Array.from(this.adapters.values())
  }
}

export const protocolRegistry = new ProtocolRegistry()
```

**Claude Code instructions:**
```
1. mkdir -p /Users/lex/settlegrid/apps/web/src/lib/settlement/adapters
2. Create types.ts with all types from section 3.4
3. Create index.ts with exports
4. Create adapters/index.ts with ProtocolRegistry class
```

**Test file:** `/Users/lex/settlegrid/apps/web/src/lib/__tests__/settlement-types.test.ts`

```typescript
// Tests to write:
// - ProtocolRegistry.register() adds adapter
// - ProtocolRegistry.register() throws on duplicate
// - ProtocolRegistry.get() returns registered adapter
// - ProtocolRegistry.get() returns undefined for unknown
// - ProtocolRegistry.detect() calls canHandle() on each adapter
// - ProtocolRegistry.detect() returns first matching adapter
// - ProtocolRegistry.detect() returns undefined when none match
// - ProtocolRegistry.list() returns all registered adapters
```

Expected: 8+ new tests

---

#### Phase 0.2: Abstract Pricing Model

**File to modify:** `/Users/lex/settlegrid/packages/mcp/src/types.ts`

Add generalized pricing types while keeping backward compatibility:

```typescript
// ADD to existing types.ts — do not remove existing PricingConfig

/** Generalized pricing model (superset of existing PricingConfig) */
export type PricingModel =
  | 'per-invocation'
  | 'per-token'
  | 'per-byte'
  | 'per-second'
  | 'tiered'
  | 'outcome'

export interface GeneralizedPricingConfig {
  model: PricingModel
  defaultCostCents: number
  currencyCode?: string
  methods?: Record<string, {
    costCents: number
    unitType?: string
    displayName?: string
  }>
  tiers?: Array<{ upTo: number; costCents: number }>
  outcomeConfig?: {
    successCostCents: number
    failureCostCents: number
    successCondition: string
  }
}
```

**File to modify:** `/Users/lex/settlegrid/packages/mcp/src/config.ts`

Extend `getMethodCost` to support the generalized model:

```typescript
// ADD new function — keep existing getMethodCost for backward compatibility

export function resolveOperationCost(
  pricing: GeneralizedPricingConfig | PricingConfig,
  method: string,
  units?: number // tokens, bytes, seconds — for non-invocation models
): number {
  // If this is the legacy PricingConfig format, delegate to getMethodCost
  if (!('model' in pricing)) {
    return getMethodCost(pricing as PricingConfig, method)
  }

  const config = pricing as GeneralizedPricingConfig

  // Check method-specific pricing first
  if (config.methods && method in config.methods) {
    const methodPrice = config.methods[method].costCents
    if (config.model === 'per-invocation' || !units) return methodPrice
    return methodPrice * (units ?? 1)
  }

  switch (config.model) {
    case 'per-invocation':
      return config.defaultCostCents
    case 'per-token':
    case 'per-byte':
    case 'per-second':
      return config.defaultCostCents * (units ?? 1)
    case 'tiered': {
      if (!config.tiers || !units) return config.defaultCostCents
      let totalCost = 0
      let remainingUnits = units
      for (const tier of config.tiers) {
        const tierUnits = Math.min(remainingUnits, tier.upTo)
        totalCost += tierUnits * tier.costCents
        remainingUnits -= tierUnits
        if (remainingUnits <= 0) break
      }
      // Any remaining units beyond the last tier use the last tier's price
      if (remainingUnits > 0 && config.tiers.length > 0) {
        totalCost += remainingUnits * config.tiers[config.tiers.length - 1].costCents
      }
      return totalCost
    }
    case 'outcome':
      // Outcome pricing is resolved after execution, not before
      // Return the success cost as a pre-authorization amount
      return config.outcomeConfig?.successCostCents ?? config.defaultCostCents
    default:
      return config.defaultCostCents
  }
}
```

**File to modify:** `/Users/lex/settlegrid/packages/mcp/src/config.ts` — Extend Zod schema

```typescript
// ADD generalized pricing schema alongside existing pricingConfigSchema

export const generalizedPricingConfigSchema = z.object({
  model: z.enum(['per-invocation', 'per-token', 'per-byte', 'per-second', 'tiered', 'outcome']),
  defaultCostCents: z.number().int().min(0),
  currencyCode: z.string().length(3).optional().default('USD'),
  methods: z.record(z.string(), z.object({
    costCents: z.number().int().min(0),
    unitType: z.string().optional(),
    displayName: z.string().optional(),
  })).optional(),
  tiers: z.array(z.object({
    upTo: z.number().int().min(1),
    costCents: z.number().int().min(0),
  })).optional(),
  outcomeConfig: z.object({
    successCostCents: z.number().int().min(0),
    failureCostCents: z.number().int().min(0),
    successCondition: z.string(),
  }).optional(),
})
```

**Test file:** `/Users/lex/settlegrid/packages/mcp/src/__tests__/pricing.test.ts`

```typescript
// Tests to write:
// - resolveOperationCost: per-invocation returns defaultCostCents
// - resolveOperationCost: per-invocation with method override
// - resolveOperationCost: per-token multiplies by units
// - resolveOperationCost: per-byte multiplies by units
// - resolveOperationCost: per-second multiplies by units
// - resolveOperationCost: tiered pricing with 2 tiers
// - resolveOperationCost: tiered pricing with units exceeding all tiers
// - resolveOperationCost: outcome returns successCostCents
// - resolveOperationCost: legacy PricingConfig format still works
// - resolveOperationCost: method override takes precedence in all models
// - generalizedPricingConfigSchema validates correct input
// - generalizedPricingConfigSchema rejects invalid model
// - generalizedPricingConfigSchema rejects negative costs
// - resolveOperationCost: tiered pricing with 0 units returns 0
// - resolveOperationCost: per-token with no units defaults to 1
```

Expected: 15+ new tests

---

#### Phase 0.3: Add Double-Entry Ledger

**Files to create:**

1. `/Users/lex/settlegrid/apps/web/src/lib/settlement/ledger.ts` — Ledger operations

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/ledger.ts

import { db } from '@/lib/db'
import { accounts, ledgerEntries } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export type LedgerCategory =
  | 'metering'    // Tool invocation charge
  | 'purchase'    // Credit top-up
  | 'payout'      // Provider payout
  | 'refund'      // Refund to customer
  | 'fee'         // Platform fee
  | 'netting'     // Batch settlement netting
  | 'delegation'  // Budget delegation to child session

export interface PostEntryParams {
  debitAccountId: string
  creditAccountId: string
  amountCents: number
  currencyCode?: string
  category: LedgerCategory
  operationId?: string
  batchId?: string
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Post a balanced double-entry to the ledger.
 *
 * This is the ONLY way to change account balances.
 * Creates two entries (one debit, one credit) and updates both account balances
 * in a single database transaction with optimistic locking.
 *
 * @returns The IDs of the two ledger entries created
 * @throws Error if optimistic lock fails (concurrent modification)
 */
export async function postLedgerEntry(params: PostEntryParams): Promise<{
  debitEntryId: string
  creditEntryId: string
}> {
  const {
    debitAccountId,
    creditAccountId,
    amountCents,
    currencyCode = 'USD',
    category,
    operationId,
    batchId,
    description,
    metadata,
  } = params

  if (amountCents <= 0) {
    throw new Error(`Ledger entry amount must be positive, got ${amountCents}`)
  }

  if (debitAccountId === creditAccountId) {
    throw new Error('Debit and credit accounts must be different')
  }

  // Use a transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    // 1. Read both accounts with their current versions
    const [debitAccount] = await tx
      .select({ id: accounts.id, version: accounts.version, balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.id, debitAccountId))
      .limit(1)

    const [creditAccount] = await tx
      .select({ id: accounts.id, version: accounts.version, balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.id, creditAccountId))
      .limit(1)

    if (!debitAccount) throw new Error(`Debit account not found: ${debitAccountId}`)
    if (!creditAccount) throw new Error(`Credit account not found: ${creditAccountId}`)

    // 2. Create the two ledger entries
    const [debitEntry] = await tx
      .insert(ledgerEntries)
      .values({
        accountId: debitAccountId,
        entryType: 'debit',
        amountCents,
        currencyCode,
        operationId,
        batchId,
        category,
        counterpartyAccountId: creditAccountId,
        description,
        metadata,
      })
      .returning({ id: ledgerEntries.id })

    const [creditEntry] = await tx
      .insert(ledgerEntries)
      .values({
        accountId: creditAccountId,
        entryType: 'credit',
        amountCents,
        currencyCode,
        operationId,
        batchId,
        category,
        counterpartyAccountId: debitAccountId,
        description,
        metadata,
      })
      .returning({ id: ledgerEntries.id })

    // 3. Update account balances with optimistic locking
    // Debit: decrease balance
    const [updatedDebit] = await tx
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} - ${amountCents}`,
        version: sql`${accounts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, debitAccountId), eq(accounts.version, debitAccount.version)))
      .returning({ id: accounts.id })

    if (!updatedDebit) {
      throw new Error(`Optimistic lock failed on debit account ${debitAccountId} — concurrent modification`)
    }

    // Credit: increase balance
    const [updatedCredit] = await tx
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} + ${amountCents}`,
        version: sql`${accounts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, creditAccountId), eq(accounts.version, creditAccount.version)))
      .returning({ id: accounts.id })

    if (!updatedCredit) {
      throw new Error(`Optimistic lock failed on credit account ${creditAccountId} — concurrent modification`)
    }

    return {
      debitEntryId: debitEntry.id,
      creditEntryId: creditEntry.id,
    }
  })
}

/**
 * Post a ledger entry asynchronously (fire-and-forget).
 * Used for the hot path where we don't want to block on DB writes.
 * Redis DECRBY handles the real-time balance; this is the durable record.
 */
export function postLedgerEntryAsync(params: PostEntryParams): void {
  postLedgerEntry(params).catch((err) => {
    logger.error('ledger.post_entry_failed', {
      debitAccountId: params.debitAccountId,
      creditAccountId: params.creditAccountId,
      amountCents: params.amountCents,
      category: params.category,
    }, err)
  })
}

/**
 * Get the computed balance for an account from ledger entries.
 * Used for reconciliation — compares with the cached balanceCents.
 */
export async function computeBalanceFromLedger(accountId: string): Promise<number> {
  const result = await db
    .select({
      totalCredits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'credit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
      totalDebits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'debit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId))

  const { totalCredits, totalDebits } = result[0]
  return Number(totalCredits) - Number(totalDebits)
}

/**
 * Reconcile an account's cached balance with the ledger.
 * Returns the discrepancy (positive = cache is higher than ledger).
 */
export async function reconcileAccount(accountId: string): Promise<{
  cachedBalance: number
  ledgerBalance: number
  discrepancy: number
}> {
  const [account] = await db
    .select({ balanceCents: accounts.balanceCents })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!account) throw new Error(`Account not found: ${accountId}`)

  const ledgerBalance = await computeBalanceFromLedger(accountId)

  return {
    cachedBalance: account.balanceCents,
    ledgerBalance,
    discrepancy: account.balanceCents - ledgerBalance,
  }
}
```

**Test file:** `/Users/lex/settlegrid/apps/web/src/lib/__tests__/ledger.test.ts`

```typescript
// Tests to write (mock DB):
// - postLedgerEntry creates balanced debit and credit entries
// - postLedgerEntry updates both account balances
// - postLedgerEntry rejects zero amount
// - postLedgerEntry rejects negative amount
// - postLedgerEntry rejects same debit and credit account
// - postLedgerEntry throws on missing debit account
// - postLedgerEntry throws on missing credit account
// - postLedgerEntry throws on optimistic lock failure (debit)
// - postLedgerEntry throws on optimistic lock failure (credit)
// - postLedgerEntryAsync does not throw on failure (logs error)
// - computeBalanceFromLedger returns credits minus debits
// - computeBalanceFromLedger returns 0 for account with no entries
// - reconcileAccount detects discrepancy between cache and ledger
// - reconcileAccount returns 0 discrepancy when in sync
// - postLedgerEntry respects currencyCode parameter
// - postLedgerEntry stores metadata correctly
// - postLedgerEntry stores operationId and batchId
```

Expected: 17+ new tests

---

#### Phase 0.4: Add Workflow Session Support

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/sessions.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/sessions.ts

import { db } from '@/lib/db'
import { workflowSessions } from '@/lib/db/schema'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { getRedis, tryRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { SessionCreateParams, SessionDelegateParams, SessionState } from './types'

// Redis key helpers
function sessionBudgetKey(sessionId: string): string {
  return `session:budget:${sessionId}`
}
function sessionSpentKey(sessionId: string): string {
  return `session:spent:${sessionId}`
}
function sessionReservedKey(sessionId: string): string {
  return `session:reserved:${sessionId}`
}

/**
 * Create a new workflow session with a budget.
 * If parentSessionId is provided, this is a delegation — the parent's
 * reserved amount is increased by budgetCents.
 */
export async function createSession(params: SessionCreateParams): Promise<SessionState> {
  const {
    customerId,
    budgetCents,
    expiresIn = 3600,
    parentSessionId,
    protocol,
    metadata,
  } = params

  if (budgetCents <= 0) {
    throw new Error('Session budget must be positive')
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  // If this is a child session, verify parent has available budget
  if (parentSessionId) {
    const [parent] = await db
      .select({
        budgetCents: workflowSessions.budgetCents,
        spentCents: workflowSessions.spentCents,
        reservedCents: workflowSessions.reservedCents,
        status: workflowSessions.status,
        expiresAt: workflowSessions.expiresAt,
      })
      .from(workflowSessions)
      .where(eq(workflowSessions.id, parentSessionId))
      .limit(1)

    if (!parent) throw new Error(`Parent session not found: ${parentSessionId}`)
    if (parent.status !== 'active') throw new Error(`Parent session is ${parent.status}`)

    const parentAvailable = parent.budgetCents - parent.spentCents - parent.reservedCents
    if (budgetCents > parentAvailable) {
      throw new Error(
        `Delegation budget (${budgetCents}) exceeds parent's available budget (${parentAvailable})`
      )
    }

    // Child session cannot expire after parent
    if (parent.expiresAt && expiresAt > new Date(parent.expiresAt)) {
      throw new Error('Child session cannot expire after parent session')
    }

    // Reserve budget on parent
    await db
      .update(workflowSessions)
      .set({
        reservedCents: sql`${workflowSessions.reservedCents} + ${budgetCents}`,
      })
      .where(eq(workflowSessions.id, parentSessionId))
  }

  // Create the session
  const [session] = await db
    .insert(workflowSessions)
    .values({
      customerId,
      parentSessionId: parentSessionId ?? null,
      budgetCents,
      spentCents: 0,
      reservedCents: 0,
      status: 'active',
      protocol: protocol ?? null,
      metadata: metadata ?? null,
      expiresAt,
    })
    .returning()

  // Hydrate Redis for fast budget checks
  const redis = getRedis()
  const ttlSeconds = Math.max(1, Math.ceil(expiresIn))
  await Promise.all([
    tryRedis(() => redis.set(sessionBudgetKey(session.id), budgetCents, { ex: ttlSeconds })),
    tryRedis(() => redis.set(sessionSpentKey(session.id), 0, { ex: ttlSeconds })),
    tryRedis(() => redis.set(sessionReservedKey(session.id), 0, { ex: ttlSeconds })),
  ])

  return {
    id: session.id,
    customerId: session.customerId,
    parentSessionId: session.parentSessionId,
    budgetCents: session.budgetCents,
    spentCents: 0,
    reservedCents: 0,
    availableCents: session.budgetCents,
    status: 'active',
    expiresAt: session.expiresAt?.toISOString() ?? null,
    children: [],
  }
}

/**
 * Check if a session has sufficient budget for an operation.
 * Uses Redis for fast path, DB for fallback.
 */
export async function checkSessionBudget(
  sessionId: string,
  costCents: number
): Promise<{ allowed: boolean; availableCents: number; reason?: string }> {
  const redis = getRedis()

  // Try Redis fast path
  const [budgetStr, spentStr, reservedStr] = await Promise.all([
    tryRedis(() => redis.get<string>(sessionBudgetKey(sessionId))),
    tryRedis(() => redis.get<string>(sessionSpentKey(sessionId))),
    tryRedis(() => redis.get<string>(sessionReservedKey(sessionId))),
  ])

  if (budgetStr !== null && budgetStr !== undefined) {
    const budget = parseInt(String(budgetStr), 10)
    const spent = parseInt(String(spentStr ?? '0'), 10)
    const reserved = parseInt(String(reservedStr ?? '0'), 10)
    const available = budget - spent - reserved

    if (costCents > available) {
      return { allowed: false, availableCents: available, reason: 'SESSION_BUDGET_EXCEEDED' }
    }
    return { allowed: true, availableCents: available - costCents }
  }

  // DB fallback
  const [session] = await db
    .select({
      budgetCents: workflowSessions.budgetCents,
      spentCents: workflowSessions.spentCents,
      reservedCents: workflowSessions.reservedCents,
      status: workflowSessions.status,
      expiresAt: workflowSessions.expiresAt,
    })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) return { allowed: false, availableCents: 0, reason: 'SESSION_NOT_FOUND' }
  if (session.status !== 'active') return { allowed: false, availableCents: 0, reason: 'SESSION_INACTIVE' }
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    return { allowed: false, availableCents: 0, reason: 'SESSION_EXPIRED' }
  }

  const available = session.budgetCents - session.spentCents - session.reservedCents
  if (costCents > available) {
    return { allowed: false, availableCents: available, reason: 'SESSION_BUDGET_EXCEEDED' }
  }
  return { allowed: true, availableCents: available - costCents }
}

/**
 * Record spending against a session. Increments spentCents in Redis and DB.
 * If the session has a parent, the spending rolls up to the parent too.
 */
export async function recordSessionSpend(sessionId: string, costCents: number): Promise<void> {
  const redis = getRedis()

  // Increment Redis (fast)
  await tryRedis(() => redis.incrby(sessionSpentKey(sessionId), costCents))

  // Increment DB
  await db
    .update(workflowSessions)
    .set({
      spentCents: sql`${workflowSessions.spentCents} + ${costCents}`,
    })
    .where(eq(workflowSessions.id, sessionId))

  // Roll up to parent if exists
  const [session] = await db
    .select({ parentSessionId: workflowSessions.parentSessionId })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (session?.parentSessionId) {
    // Parent's spentCents also increases (the reserved amount stays the same)
    await tryRedis(() => redis.incrby(sessionSpentKey(session.parentSessionId!), costCents))
    await db
      .update(workflowSessions)
      .set({
        spentCents: sql`${workflowSessions.spentCents} + ${costCents}`,
      })
      .where(eq(workflowSessions.id, session.parentSessionId))
  }
}

/**
 * Complete a session. Releases any unused reserved budget back to parent.
 */
export async function completeSession(sessionId: string): Promise<void> {
  const [session] = await db
    .select({
      parentSessionId: workflowSessions.parentSessionId,
      budgetCents: workflowSessions.budgetCents,
      spentCents: workflowSessions.spentCents,
      reservedCents: workflowSessions.reservedCents,
    })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) throw new Error(`Session not found: ${sessionId}`)

  // Mark as completed
  await db
    .update(workflowSessions)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(workflowSessions.id, sessionId))

  // Release unused delegation back to parent
  if (session.parentSessionId) {
    const unusedBudget = session.budgetCents - session.spentCents
    if (unusedBudget > 0) {
      await db
        .update(workflowSessions)
        .set({
          reservedCents: sql`GREATEST(${workflowSessions.reservedCents} - ${unusedBudget}, 0)`,
        })
        .where(eq(workflowSessions.id, session.parentSessionId))
    }
  }

  // Clean up Redis
  const redis = getRedis()
  await Promise.all([
    tryRedis(() => redis.del(sessionBudgetKey(sessionId))),
    tryRedis(() => redis.del(sessionSpentKey(sessionId))),
    tryRedis(() => redis.del(sessionReservedKey(sessionId))),
  ])
}

/**
 * Get full session state including children (recursive).
 */
export async function getSessionState(sessionId: string): Promise<SessionState | null> {
  const [session] = await db
    .select()
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) return null

  // Get child sessions (one level — not deeply recursive to avoid N+1)
  const children = await db
    .select()
    .from(workflowSessions)
    .where(eq(workflowSessions.parentSessionId, sessionId))

  return {
    id: session.id,
    customerId: session.customerId,
    parentSessionId: session.parentSessionId,
    budgetCents: session.budgetCents,
    spentCents: session.spentCents,
    reservedCents: session.reservedCents,
    availableCents: session.budgetCents - session.spentCents - session.reservedCents,
    status: session.status as SessionState['status'],
    expiresAt: session.expiresAt?.toISOString() ?? null,
    children: children.map((child) => ({
      id: child.id,
      customerId: child.customerId,
      parentSessionId: child.parentSessionId,
      budgetCents: child.budgetCents,
      spentCents: child.spentCents,
      reservedCents: child.reservedCents,
      availableCents: child.budgetCents - child.spentCents - child.reservedCents,
      status: child.status as SessionState['status'],
      expiresAt: child.expiresAt?.toISOString() ?? null,
      children: [], // one level deep only
    })),
  }
}
```

**API routes to create:**

1. `POST /api/sessions` — Create a new session
   - File: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/route.ts`
   - Body: `{ customerId, budgetCents, expiresIn?, parentSessionId?, protocol?, metadata? }`
   - Auth: Consumer API key
   - Response: `SessionState`

2. `GET /api/sessions/[id]` — Get session state
   - File: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/route.ts`
   - Auth: Consumer API key (must own the session)
   - Response: `SessionState` with children

3. `POST /api/sessions/[id]/delegate` — Delegate budget to child session
   - File: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/delegate/route.ts`
   - Body: `{ budgetCents, agentId?, expiresIn?, metadata? }`
   - Auth: Consumer API key
   - Response: `SessionState` of the new child session

4. `POST /api/sessions/[id]/complete` — Complete a session
   - File: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/complete/route.ts`
   - Auth: Consumer API key
   - Response: `{ success: true }`

**Test file:** `/Users/lex/settlegrid/apps/web/src/lib/__tests__/sessions.test.ts`

```typescript
// Tests to write:
// - createSession creates session with correct budget
// - createSession rejects zero budget
// - createSession rejects negative budget
// - createSession with parent verifies parent has available budget
// - createSession with parent rejects if delegation exceeds available
// - createSession with parent rejects if parent is not active
// - createSession with parent rejects if child expires after parent
// - createSession hydrates Redis with budget keys
// - checkSessionBudget allows operation within budget (Redis path)
// - checkSessionBudget rejects operation exceeding budget (Redis path)
// - checkSessionBudget falls back to DB when Redis misses
// - checkSessionBudget rejects expired session
// - checkSessionBudget rejects inactive session
// - recordSessionSpend increments spent in Redis and DB
// - recordSessionSpend rolls up to parent session
// - completeSession marks session as completed
// - completeSession releases unused budget to parent
// - completeSession cleans up Redis keys
// - getSessionState returns session with children
// - getSessionState returns null for unknown session
```

Expected: 20+ new tests

---

#### Phase 0.5: Implement MCP Protocol Adapter

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/adapters/mcp.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/adapters/mcp.ts

import type { ProtocolAdapter, PaymentContext, SettlementResult } from '../types'
import { v4 as uuidv4 } from 'crypto'

/**
 * MCP Protocol Adapter
 *
 * Extracts payment context from MCP requests where the API key is in:
 * 1. MCP _meta.settlegrid-api-key
 * 2. x-api-key header
 * 3. Authorization: Bearer header
 *
 * This adapter handles requests coming through the existing @settlegrid/mcp SDK.
 */
export class MCPAdapter implements ProtocolAdapter {
  readonly name = 'mcp' as const
  readonly displayName = 'Model Context Protocol'

  canHandle(request: Request): boolean {
    // MCP requests are identified by:
    // 1. Presence of settlegrid-api-key in body metadata
    // 2. x-settlegrid-protocol: mcp header
    // 3. Content-Type: application/json with toolSlug in body (SDK calls)
    const protocol = request.headers.get('x-settlegrid-protocol')
    if (protocol === 'mcp') return true

    // Fallback: if no protocol header, check for x-api-key (legacy SDK behavior)
    const hasApiKey = request.headers.get('x-api-key') !== null
    const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ') ?? false
    // MCP is the default protocol when using API keys without explicit protocol header
    return hasApiKey || hasBearer
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const body = await request.clone().json()

    // Extract API key from various sources
    let apiKey: string | null = null

    // 1. MCP metadata (from _meta in tool call)
    if (body?.metadata?.['settlegrid-api-key']) {
      apiKey = String(body.metadata['settlegrid-api-key'])
    }
    if (!apiKey && body?.metadata?.['x-api-key']) {
      apiKey = String(body.metadata['x-api-key'])
    }

    // 2. Headers
    if (!apiKey) {
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7)
      }
    }
    if (!apiKey) {
      apiKey = request.headers.get('x-api-key')
    }

    if (!apiKey) {
      throw new Error('No API key found in MCP request')
    }

    return {
      protocol: 'mcp',
      identity: {
        type: 'api-key',
        value: apiKey,
      },
      operation: {
        service: body.toolSlug ?? '',
        method: body.method ?? 'default',
        params: body.params,
      },
      payment: {
        type: 'credit-balance',
      },
      session: body.sessionId ? { id: body.sessionId } : undefined,
      requestId: request.headers.get('x-request-id') ?? uuidv4(),
    }
  }

  formatResponse(result: SettlementResult): Response {
    const status = result.status === 'rejected' ? 402
      : result.status === 'failed' ? 500
      : 200

    return new Response(JSON.stringify({
      success: result.status === 'settled' || result.status === 'pending',
      remainingBalanceCents: result.remainingBalanceCents,
      costCents: result.costCents,
      invocationId: result.operationId,
      isFlagged: result.metadata?.protocol === 'mcp' ? undefined : undefined,
      ...(result.error ? { error: result.error.message, code: result.error.code } : {}),
    }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  formatError(error: Error): Response {
    const isInsufficientCredits = error.message.includes('Insufficient')
    const status = isInsufficientCredits ? 402 : 500

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      code: isInsufficientCredits ? 'INSUFFICIENT_CREDITS' : 'INTERNAL_ERROR',
    }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

**Register the adapter:** In `/Users/lex/settlegrid/apps/web/src/lib/settlement/adapters/index.ts`, add after the class definition:

```typescript
import { MCPAdapter } from './mcp'

// ... ProtocolRegistry class ...

export const protocolRegistry = new ProtocolRegistry()

// Register built-in adapters
protocolRegistry.register(new MCPAdapter())
```

**Test file:** `/Users/lex/settlegrid/apps/web/src/lib/__tests__/mcp-adapter.test.ts`

```typescript
// Tests to write:
// - MCPAdapter.name is 'mcp'
// - MCPAdapter.canHandle returns true for x-settlegrid-protocol: mcp header
// - MCPAdapter.canHandle returns true for x-api-key header
// - MCPAdapter.canHandle returns true for Authorization: Bearer header
// - MCPAdapter.canHandle returns false for request with no API key or protocol header
// - MCPAdapter.extractPaymentContext extracts API key from metadata
// - MCPAdapter.extractPaymentContext extracts API key from x-api-key header
// - MCPAdapter.extractPaymentContext extracts API key from Authorization header
// - MCPAdapter.extractPaymentContext throws when no API key found
// - MCPAdapter.extractPaymentContext extracts toolSlug and method from body
// - MCPAdapter.extractPaymentContext extracts sessionId when present
// - MCPAdapter.extractPaymentContext generates requestId when not in header
// - MCPAdapter.formatResponse returns 200 for settled result
// - MCPAdapter.formatResponse returns 402 for rejected result
// - MCPAdapter.formatResponse returns 500 for failed result
// - MCPAdapter.formatResponse includes remainingBalanceCents
// - MCPAdapter.formatError returns 402 for insufficient credits
// - MCPAdapter.formatError returns 500 for other errors
```

Expected: 18+ new tests

---

#### Phase 0.6: Database Migration

**Drizzle migration instructions:**

After adding all new table definitions to `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts`, generate and run the migration:

```bash
cd /Users/lex/settlegrid/apps/web
npx drizzle-kit generate --name add-settlement-tables
npx drizzle-kit migrate
```

**Migration checklist:**
- [ ] `accounts` table created with indexes
- [ ] `ledgerEntries` table created with indexes, FK to accounts with `onDelete: 'restrict'`
- [ ] `workflowSessions` table created with self-referencing FK
- [ ] `agentIdentities` table created with unique fingerprint index
- [ ] `settlementBatches` table created
- [ ] `paymentRails` table created with unique provider+type index
- [ ] `protocolAdapters` table created with unique protocol index
- [ ] Add `protocol`, `unitType`, `currencyCode` columns to `tools` table
- [ ] Add `protocol`, `accountId` columns to `invocations` table
- [ ] Add CHECK constraint: `ledgerEntries.amountCents > 0`
- [ ] Add CHECK constraint: `accounts.type IN ('provider', 'customer', 'platform', 'escrow')`
- [ ] Add CHECK constraint: `workflowSessions.budgetCents > 0`
- [ ] Add CHECK constraint: `workflowSessions.status IN ('active', 'completed', 'expired', 'cancelled')`
- [ ] Seed platform account: INSERT INTO accounts (type, entity_type, entity_id, currency_code) VALUES ('platform', 'system', '00000000-0000-0000-0000-000000000000', 'USD')
- [ ] Seed protocol adapters: INSERT INTO protocol_adapters (protocol, display_name, status) VALUES ('mcp', 'Model Context Protocol', 'active')

**Phase 0 total expected new tests**: 8 + 15 + 17 + 20 + 18 = **78+ new tests**
**Phase 0 total test count target**: 832 + 78 = **910+ tests**

---

### Phase 1: x402 Facilitator (2 weeks)

**Goal**: Become an x402 facilitator, making SettleGrid interoperable with the 75.4M+ transaction x402 ecosystem. This adds crypto settlement alongside the existing fiat (Stripe) path.

**Success criteria**:
- x402 exact scheme (EIP-3009) verification and settlement on Base
- x402 upto scheme (Permit2) verification and settlement on Base
- X402Adapter registered in ProtocolRegistry
- Gas management for on-chain settlement transactions
- Cryptographic receipt generation (offer-and-receipt extension)
- 40+ new tests covering all x402 flows

**Dependencies**: Phase 0 complete (PaymentContext type, ProtocolAdapter interface, accounts + ledger tables)

**New npm dependencies:**

```bash
cd /Users/lex/settlegrid/apps/web
npm install viem @coinbase/x402 ethers
```

- `viem` — Type-safe Ethereum client (EIP-712 signature verification, contract calls)
- `@coinbase/x402` — Official x402 SDK types and utilities (if available; otherwise implement from spec)
- `ethers` — Fallback ABI encoding/decoding

---

#### Phase 1.1: x402 Types and Constants

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/x402/types.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/x402/types.ts

/**
 * x402 Protocol Types
 * Based on the x402 v2 specification: https://github.com/coinbase/x402
 */

/** Supported x402 payment schemes */
export type X402Scheme = 'exact' | 'upto'

/** Supported networks (CAIP-2 format) */
export type X402Network = 'eip155:8453' | 'eip155:84532' | 'eip155:1' // Base, Base Sepolia, Ethereum

/** USDC contract addresses per network */
export const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base mainnet USDC
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum mainnet USDC
}

/** x402Permit2Proxy contract addresses */
export const PERMIT2_PROXY_ADDRESSES: Record<string, `0x${string}`> = {
  'eip155:8453': '0x0000000000000000000000000000000000000000',  // TBD: deploy or use Coinbase's
  'eip155:84532': '0x0000000000000000000000000000000000000000', // TBD
}

/** Permit2 canonical addresses */
export const PERMIT2_ADDRESSES: Record<string, `0x${string}`> = {
  'eip155:8453': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  'eip155:84532': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  'eip155:1': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
}

/**
 * x402 PaymentRequired response (server -> client)
 * Sent as JSON body with HTTP 402 status
 */
export interface X402PaymentRequired {
  /** Payment acceptance details */
  accepts: Array<{
    scheme: X402Scheme
    network: X402Network
    maxAmountRequired: string  // in token base units (6 decimals for USDC)
    resource: string           // URL of the protected resource
    description?: string
    mimeType?: string
    maxTimeoutSeconds?: number
    asset: string              // token contract address
    extra?: Record<string, unknown>
  }>
  /** Error description */
  error?: string
}

/**
 * x402 exact scheme payment payload (client -> facilitator)
 * EIP-3009 transferWithAuthorization
 */
export interface X402ExactPayload {
  scheme: 'exact'
  network: X402Network
  payload: {
    signature: `0x${string}`       // EIP-712 signature
    authorization: {
      from: `0x${string}`          // payer address
      to: `0x${string}`            // payee (provider's wallet)
      value: string                 // amount in base units
      validAfter: string            // unix timestamp
      validBefore: string           // unix timestamp
      nonce: `0x${string}`         // random nonce
    }
  }
}

/**
 * x402 upto scheme payment payload (client -> facilitator)
 * Permit2 permitWitnessTransferFrom
 */
export interface X402UptoPayload {
  scheme: 'upto'
  network: X402Network
  payload: {
    signature: `0x${string}`
    permit: {
      permitted: {
        token: `0x${string}`
        amount: string
      }
      nonce: string
      deadline: string
    }
    witness: {
      recipient: `0x${string}`
      amount: string                // actual settlement amount (<= permitted amount)
    }
    transferDetails: {
      to: `0x${string}`
      requestedAmount: string
    }
  }
}

export type X402PaymentPayload = X402ExactPayload | X402UptoPayload

/**
 * Facilitator verify response
 */
export interface X402VerifyResponse {
  isValid: boolean
  invalidReason?: string
  payer?: `0x${string}`
  network?: X402Network
}

/**
 * Facilitator settle response
 */
export interface X402SettleResponse {
  success: boolean
  txHash?: `0x${string}`
  network?: X402Network
  errorReason?: string
}

/**
 * Cryptographic receipt (offer-and-receipt extension)
 */
export interface X402Receipt {
  txHash: `0x${string}`
  network: X402Network
  payer: `0x${string}`
  payee: `0x${string}`
  amount: string
  timestamp: number
  facilitatorSignature: `0x${string}`  // SettleGrid signs the receipt
}
```

---

#### Phase 1.2: x402 Verification Engine

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/x402/verify.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/x402/verify.ts

import { createPublicClient, http, type PublicClient, type Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import type { X402ExactPayload, X402UptoPayload, X402VerifyResponse, X402Network } from './types'
import { USDC_ADDRESSES } from './types'
import { logger } from '@/lib/logger'

// EIP-3009 TransferWithAuthorization ABI (subset for verification)
const EIP3009_ABI = [
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** Get the viem chain config for a CAIP-2 network ID */
function getChain(network: X402Network) {
  switch (network) {
    case 'eip155:8453': return base
    case 'eip155:84532': return baseSepolia
    default: throw new Error(`Unsupported network: ${network}`)
  }
}

/** Get a public client for the given network */
function getClient(network: X402Network): PublicClient {
  const chain = getChain(network)
  return createPublicClient({
    chain,
    transport: http(), // Uses default RPC; configure with env var for production
  })
}

/**
 * Verify an x402 exact scheme payment (EIP-3009).
 *
 * Checks:
 * 1. Signature is valid (recovers to the `from` address)
 * 2. Authorization nonce has not been used
 * 3. validAfter <= now <= validBefore
 * 4. Payer has sufficient USDC balance
 */
export async function verifyExactPayment(
  payload: X402ExactPayload
): Promise<X402VerifyResponse> {
  try {
    const { network, payload: p } = payload
    const { signature, authorization } = p
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return { isValid: false, invalidReason: `Unsupported network: ${network}` }
    }

    const client = getClient(network)
    const now = Math.floor(Date.now() / 1000)

    // Check time validity
    const validAfter = parseInt(authorization.validAfter, 10)
    const validBefore = parseInt(authorization.validBefore, 10)

    if (now < validAfter) {
      return { isValid: false, invalidReason: 'Authorization not yet valid', payer: authorization.from, network }
    }
    if (now > validBefore) {
      return { isValid: false, invalidReason: 'Authorization expired', payer: authorization.from, network }
    }

    // Check nonce not used
    const nonceUsed = await client.readContract({
      address: usdcAddress,
      abi: EIP3009_ABI,
      functionName: 'authorizationState',
      args: [authorization.from as Address, authorization.nonce as `0x${string}`],
    })

    if (nonceUsed) {
      return { isValid: false, invalidReason: 'Authorization nonce already used', payer: authorization.from, network }
    }

    // Check balance
    const balance = await client.readContract({
      address: usdcAddress,
      abi: EIP3009_ABI,
      functionName: 'balanceOf',
      args: [authorization.from as Address],
    })

    const requiredAmount = BigInt(authorization.value)
    if (balance < requiredAmount) {
      return {
        isValid: false,
        invalidReason: `Insufficient USDC balance: has ${balance}, needs ${requiredAmount}`,
        payer: authorization.from,
        network,
      }
    }

    // TODO: Verify EIP-712 signature recovery matches authorization.from
    // This requires reconstructing the EIP-712 domain and types for USDC's
    // TransferWithAuthorization. Implementation depends on the specific
    // USDC contract version on each chain.

    return { isValid: true, payer: authorization.from, network }
  } catch (error) {
    logger.error('x402.verify_exact_failed', { network: payload.network }, error as Error)
    return { isValid: false, invalidReason: `Verification error: ${(error as Error).message}` }
  }
}

/**
 * Verify an x402 upto scheme payment (Permit2).
 *
 * Checks:
 * 1. Signature is valid
 * 2. Permit nonce has not been used
 * 3. deadline >= now
 * 4. Payer has sufficient USDC balance + Permit2 allowance
 * 5. Witness amount <= permitted amount
 */
export async function verifyUptoPayment(
  payload: X402UptoPayload
): Promise<X402VerifyResponse> {
  try {
    const { network, payload: p } = payload
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return { isValid: false, invalidReason: `Unsupported network: ${network}` }
    }

    const client = getClient(network)
    const now = Math.floor(Date.now() / 1000)

    // Check deadline
    const deadline = parseInt(p.permit.deadline, 10)
    if (now > deadline) {
      return { isValid: false, invalidReason: 'Permit deadline expired', network }
    }

    // Check witness amount <= permitted amount
    const permittedAmount = BigInt(p.permit.permitted.amount)
    const witnessAmount = BigInt(p.witness.amount)
    if (witnessAmount > permittedAmount) {
      return {
        isValid: false,
        invalidReason: `Witness amount (${witnessAmount}) exceeds permitted amount (${permittedAmount})`,
        network,
      }
    }

    // Check balance (we need to resolve the payer from the signature)
    // For now, we verify the amounts are consistent and the signature is well-formed
    // Full Permit2 signature verification requires the Permit2 contract's verification

    return { isValid: true, network }
  } catch (error) {
    logger.error('x402.verify_upto_failed', { network: payload.network }, error as Error)
    return { isValid: false, invalidReason: `Verification error: ${(error as Error).message}` }
  }
}
```

---

#### Phase 1.3: x402 Settlement Engine

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/x402/settle.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/x402/settle.ts

import { createWalletClient, http, type WalletClient, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import type { X402ExactPayload, X402UptoPayload, X402SettleResponse, X402Network, X402Receipt } from './types'
import { USDC_ADDRESSES } from './types'
import { logger } from '@/lib/logger'

// EIP-3009 TransferWithAuthorization ABI (for settlement)
const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

/** Gas wallet account for submitting settlement transactions */
function getGasWallet() {
  const privateKey = process.env.SETTLEGRID_GAS_WALLET_KEY
  if (!privateKey) throw new Error('SETTLEGRID_GAS_WALLET_KEY not configured')
  return privateKeyToAccount(privateKey as `0x${string}`)
}

/** Get wallet client for the given network */
function getWalletClient(network: X402Network): WalletClient {
  const account = getGasWallet()
  switch (network) {
    case 'eip155:8453':
      return createWalletClient({ account, chain: base, transport: http() })
    case 'eip155:84532':
      return createWalletClient({ account, chain: baseSepolia, transport: http() })
    default:
      throw new Error(`Unsupported network: ${network}`)
  }
}

/**
 * Settle an x402 exact scheme payment by calling transferWithAuthorization on-chain.
 *
 * This submits the pre-signed authorization to the USDC contract, which transfers
 * funds from the payer to the payee. SettleGrid's gas wallet pays the gas fee.
 */
export async function settleExactPayment(
  payload: X402ExactPayload
): Promise<X402SettleResponse> {
  try {
    const { network, payload: p } = payload
    const { signature, authorization } = p
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return { success: false, errorReason: `Unsupported network: ${network}` }
    }

    // Split signature into v, r, s
    const sig = signature.slice(2) // remove 0x
    const r = `0x${sig.slice(0, 64)}` as `0x${string}`
    const s = `0x${sig.slice(64, 128)}` as `0x${string}`
    const v = parseInt(sig.slice(128, 130), 16)

    const client = getWalletClient(network)

    const txHash = await client.writeContract({
      address: usdcAddress,
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from as Address,
        authorization.to as Address,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce as `0x${string}`,
        v,
        r,
        s,
      ],
    })

    logger.info('x402.settle_exact_success', {
      txHash,
      network,
      from: authorization.from,
      to: authorization.to,
      value: authorization.value,
    })

    return { success: true, txHash, network }
  } catch (error) {
    logger.error('x402.settle_exact_failed', { network: payload.network }, error as Error)
    return { success: false, errorReason: (error as Error).message, network: payload.network }
  }
}

/**
 * Generate a cryptographic receipt for a settled x402 payment.
 * SettleGrid signs the receipt with its gas wallet for non-repudiation.
 */
export async function generateReceipt(
  txHash: `0x${string}`,
  network: X402Network,
  payer: `0x${string}`,
  payee: `0x${string}`,
  amount: string
): Promise<X402Receipt> {
  const account = getGasWallet()
  const timestamp = Math.floor(Date.now() / 1000)

  // Sign a message containing the receipt data
  const receiptData = `${txHash}:${network}:${payer}:${payee}:${amount}:${timestamp}`
  const facilitatorSignature = await account.signMessage({
    message: receiptData,
  })

  return {
    txHash,
    network,
    payer,
    payee,
    amount,
    timestamp,
    facilitatorSignature,
  }
}
```

---

#### Phase 1.4: x402 API Routes

**File to create:** `/Users/lex/settlegrid/apps/web/src/app/api/x402/verify/route.ts`

```typescript
// POST /api/x402/verify
// Accepts: { paymentPayload, paymentRequirements }
// Returns: { isValid, invalidReason?, payer?, network? }

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { verifyExactPayment, verifyUptoPayment } from '@/lib/settlement/x402/verify'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { logger } from '@/lib/logger'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const verifySchema = z.object({
  paymentPayload: z.object({
    scheme: z.enum(['exact', 'upto']),
    network: z.string(),
    payload: z.record(z.unknown()),
  }),
  paymentRequirements: z.object({
    maxAmountRequired: z.string(),
    resource: z.string(),
    asset: z.string(),
    network: z.string(),
  }).optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `x402-verify:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, verifySchema)
    const { paymentPayload } = body

    let result
    if (paymentPayload.scheme === 'exact') {
      result = await verifyExactPayment(paymentPayload as any)
    } else if (paymentPayload.scheme === 'upto') {
      result = await verifyUptoPayment(paymentPayload as any)
    } else {
      return errorResponse('Unsupported payment scheme', 400)
    }

    logger.info('x402.verify', {
      scheme: paymentPayload.scheme,
      network: paymentPayload.network,
      isValid: result.isValid,
    })

    return successResponse(result)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
```

**File to create:** `/Users/lex/settlegrid/apps/web/src/app/api/x402/settle/route.ts`

```typescript
// POST /api/x402/settle
// Accepts: { paymentPayload, paymentRequirements }
// Returns: { success, txHash?, network?, errorReason? }

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { verifyExactPayment } from '@/lib/settlement/x402/verify'
import { settleExactPayment, generateReceipt } from '@/lib/settlement/x402/settle'
import { postLedgerEntryAsync } from '@/lib/settlement/ledger'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { logger } from '@/lib/logger'

export const maxDuration = 60 // On-chain settlement can take time
export { corsOptions as OPTIONS }

const settleSchema = z.object({
  paymentPayload: z.object({
    scheme: z.enum(['exact', 'upto']),
    network: z.string(),
    payload: z.record(z.unknown()),
  }),
  paymentRequirements: z.object({
    maxAmountRequired: z.string(),
    resource: z.string(),
    asset: z.string(),
    network: z.string(),
  }),
  generateReceipt: z.boolean().optional().default(false),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `x402-settle:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, settleSchema)
    const { paymentPayload } = body

    // Only exact scheme settlement is implemented in Phase 1
    if (paymentPayload.scheme !== 'exact') {
      return errorResponse('Only exact scheme settlement is currently supported', 400)
    }

    // Verify first
    const verification = await verifyExactPayment(paymentPayload as any)
    if (!verification.isValid) {
      return errorResponse(
        verification.invalidReason ?? 'Payment verification failed',
        402,
        'PAYMENT_INVALID'
      )
    }

    // Settle on-chain
    const settlement = await settleExactPayment(paymentPayload as any)
    if (!settlement.success) {
      return errorResponse(
        settlement.errorReason ?? 'Settlement failed',
        500,
        'SETTLEMENT_FAILED'
      )
    }

    // Record in ledger (async — don't block the response)
    // TODO: Map x402 payer/payee to SettleGrid account IDs
    // For now, log the settlement for reconciliation

    logger.info('x402.settle_complete', {
      txHash: settlement.txHash,
      network: settlement.network,
      scheme: 'exact',
    })

    // Generate receipt if requested
    let receipt
    if (body.generateReceipt && settlement.txHash && verification.payer) {
      const p = (paymentPayload as any).payload.authorization
      receipt = await generateReceipt(
        settlement.txHash,
        paymentPayload.network as any,
        verification.payer,
        p.to,
        p.value
      )
    }

    return successResponse({
      success: true,
      txHash: settlement.txHash,
      network: settlement.network,
      receipt,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
})
```

**File to create:** `/Users/lex/settlegrid/apps/web/src/app/api/x402/supported/route.ts`

```typescript
// GET /api/x402/supported
// Returns supported schemes, networks, and assets

import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api'
import { USDC_ADDRESSES } from '@/lib/settlement/x402/types'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 10
export { corsOptions as OPTIONS }

export const GET = withCors(async function GET(_request: NextRequest) {
  return successResponse({
    facilitator: 'settlegrid',
    version: '1.0.0',
    schemes: [
      {
        scheme: 'exact',
        description: 'EIP-3009 transferWithAuthorization for fixed-amount payments',
        status: 'active',
      },
      {
        scheme: 'upto',
        description: 'Permit2 permitWitnessTransferFrom for variable-amount payments',
        status: 'beta',
      },
    ],
    networks: Object.keys(USDC_ADDRESSES).map((network) => ({
      network,
      asset: USDC_ADDRESSES[network],
      assetSymbol: 'USDC',
      assetDecimals: 6,
    })),
    extensions: ['offer-and-receipt', 'payment-identifier'],
  })
})
```

---

#### Phase 1.5: x402 Protocol Adapter

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/adapters/x402.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/adapters/x402.ts

import type { ProtocolAdapter, PaymentContext, SettlementResult } from '../types'
import type { X402PaymentRequired } from '../x402/types'
import { v4 as uuidv4 } from 'crypto'

/**
 * x402 Protocol Adapter
 *
 * Handles requests with:
 * 1. PAYMENT-SIGNATURE header (x402 payment proof)
 * 2. x-settlegrid-protocol: x402 header
 * 3. HTTP 402 response formatting with PaymentRequired body
 */
export class X402Adapter implements ProtocolAdapter {
  readonly name = 'x402' as const
  readonly displayName = 'x402 Protocol (Coinbase)'

  canHandle(request: Request): boolean {
    const protocol = request.headers.get('x-settlegrid-protocol')
    if (protocol === 'x402') return true

    // x402 requests carry payment proof in PAYMENT-SIGNATURE header
    return request.headers.get('payment-signature') !== null
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const paymentSignature = request.headers.get('payment-signature')
    if (!paymentSignature) {
      throw new Error('No PAYMENT-SIGNATURE header in x402 request')
    }

    // Parse the payment signature (base64-encoded JSON payload)
    let paymentPayload: Record<string, unknown>
    try {
      paymentPayload = JSON.parse(atob(paymentSignature))
    } catch {
      throw new Error('Invalid PAYMENT-SIGNATURE header: not valid base64 JSON')
    }

    const scheme = paymentPayload.scheme as string
    const network = paymentPayload.network as string

    // Extract payer address from the payload
    let payerAddress: string | undefined
    if (scheme === 'exact') {
      payerAddress = (paymentPayload.payload as Record<string, unknown>)?.authorization
        ? ((paymentPayload.payload as Record<string, Record<string, unknown>>).authorization.from as string)
        : undefined
    }

    return {
      protocol: 'x402',
      identity: {
        type: 'did:key', // x402 identifies by wallet address
        value: payerAddress ?? 'unknown',
        metadata: { network, scheme },
      },
      operation: {
        service: request.headers.get('x-settlegrid-service') ?? new URL(request.url).pathname,
        method: request.method,
      },
      payment: {
        type: scheme === 'exact' ? 'eip3009' : 'permit2',
        proof: paymentSignature,
        amount: paymentPayload.amount
          ? { value: BigInt(paymentPayload.amount as string), currency: 'USDC' }
          : undefined,
      },
      requestId: request.headers.get('x-request-id')
        ?? request.headers.get('payment-identifier')
        ?? uuidv4(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    if (result.status === 'rejected') {
      // Return 402 with payment requirements
      const paymentRequired: X402PaymentRequired = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            maxAmountRequired: String(result.costCents * 10000), // cents to USDC base units (6 decimals)
            resource: '',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          },
        ],
        error: result.error?.message,
      }
      return new Response(JSON.stringify(paymentRequired), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Protocol': 'x402',
        },
      })
    }

    // Success: return the settlement result with receipt in header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (result.receipt) {
      headers['Payment-Response'] = btoa(result.receipt)
    }

    return new Response(JSON.stringify({
      success: true,
      txHash: result.txHash,
      operationId: result.operationId,
      costCents: result.costCents,
    }), {
      status: 200,
      headers,
    })
  }

  formatError(error: Error, _request: Request): Response {
    return new Response(JSON.stringify({
      error: error.message,
      accepts: [],
    }), {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Protocol': 'x402',
      },
    })
  }
}
```

Register in `/Users/lex/settlegrid/apps/web/src/lib/settlement/adapters/index.ts`:

```typescript
import { MCPAdapter } from './mcp'
import { X402Adapter } from './x402'

// ... ProtocolRegistry class ...

export const protocolRegistry = new ProtocolRegistry()
protocolRegistry.register(new MCPAdapter())
protocolRegistry.register(new X402Adapter())
```

---

#### Phase 1.6: Gas Management

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/x402/gas.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/x402/gas.ts

import { createPublicClient, http, formatEther, parseEther, type Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import type { X402Network } from './types'
import { logger } from '@/lib/logger'
import { getRedis, tryRedis } from '@/lib/redis'

const GAS_BALANCE_KEY = 'x402:gas:balance'
const GAS_ALERT_THRESHOLD_ETH = '0.01' // Alert when below 0.01 ETH

/**
 * Check the gas wallet balance and log a warning if low.
 * Called periodically by a cron job.
 */
export async function checkGasBalance(
  walletAddress: Address,
  network: X402Network = 'eip155:8453'
): Promise<{ balanceEth: string; isLow: boolean }> {
  const chain = network === 'eip155:8453' ? base : baseSepolia
  const client = createPublicClient({ chain, transport: http() })

  const balance = await client.getBalance({ address: walletAddress })
  const balanceEth = formatEther(balance)
  const thresholdWei = parseEther(GAS_ALERT_THRESHOLD_ETH)
  const isLow = balance < thresholdWei

  // Cache in Redis for dashboard display
  const redis = getRedis()
  await tryRedis(() => redis.set(GAS_BALANCE_KEY, JSON.stringify({
    balanceEth,
    balanceWei: balance.toString(),
    network,
    isLow,
    checkedAt: new Date().toISOString(),
  })))

  if (isLow) {
    logger.warn('x402.gas_balance_low', {
      walletAddress,
      balanceEth,
      threshold: GAS_ALERT_THRESHOLD_ETH,
      network,
    })
  }

  return { balanceEth, isLow }
}

/**
 * Estimate gas cost for a transferWithAuthorization call.
 * Returns estimated cost in ETH.
 */
export async function estimateSettlementGas(
  network: X402Network = 'eip155:8453'
): Promise<{ gasEstimate: bigint; gasPriceGwei: string; costEth: string }> {
  const chain = network === 'eip155:8453' ? base : baseSepolia
  const client = createPublicClient({ chain, transport: http() })

  // transferWithAuthorization typically uses ~65,000 gas on Base
  const gasEstimate = BigInt(65000)
  const gasPrice = await client.getGasPrice()
  const cost = gasEstimate * gasPrice

  return {
    gasEstimate,
    gasPriceGwei: (gasPrice / BigInt(1e9)).toString(),
    costEth: formatEther(cost),
  }
}
```

**Test expectations for Phase 1:** 40+ new tests covering:
- x402 type validation (5 tests)
- Exact scheme verification logic (8 tests)
- Upto scheme verification logic (6 tests)
- Settlement execution (5 tests)
- Receipt generation (3 tests)
- X402Adapter.canHandle (3 tests)
- X402Adapter.extractPaymentContext (4 tests)
- X402Adapter.formatResponse (3 tests)
- Gas balance checking (3 tests)

**Phase 1 total test count target**: 910 + 40 = **950+ tests**

---

### Phase 2: MCP Payment SEP + Enhanced SDK (2 weeks)

**Goal**: Standardize MCP billing through a Standards Enhancement Proposal and ship the generalized SDK that supports MCP, REST, and x402 use cases.

**Success criteria**:
- @settlegrid/sdk published (with @settlegrid/mcp as backward-compatible alias)
- REST middleware for Express/Next.js routes
- MCP experimental.payment capability implemented
- MCP Server Card pricing metadata schema defined
- 3 reference MCP servers built using SettleGrid
- SEP draft submitted to MCP spec repo
- 30+ new tests

---

#### Phase 2.1: Generalized SDK

**Rename strategy**: The npm package stays as `@settlegrid/mcp` for now (avoiding a breaking change), but we add `@settlegrid/sdk` as an alias in the monorepo. The package.json gets an additional entry point.

**File to modify:** `/Users/lex/settlegrid/packages/mcp/package.json`

```json
{
  "name": "@settlegrid/mcp",
  "version": "0.2.0",
  "description": "The Settlement Layer for the AI Economy — SDK for monetizing AI tools",
  "keywords": ["settlegrid", "mcp", "x402", "ai", "billing", "settlement", "sdk"],
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./x402": {
      "types": "./dist/x402.d.ts",
      "import": "./dist/x402.mjs",
      "require": "./dist/x402.js"
    },
    "./rest": {
      "types": "./dist/rest.d.ts",
      "import": "./dist/rest.mjs",
      "require": "./dist/rest.js"
    }
  }
}
```

**File to create:** `/Users/lex/settlegrid/packages/mcp/src/rest.ts` — REST middleware

```typescript
// /Users/lex/settlegrid/packages/mcp/src/rest.ts

/**
 * REST middleware for Express / Next.js API routes
 *
 * @example
 * // Next.js App Router
 * import { settlegridMiddleware } from '@settlegrid/mcp/rest'
 *
 * const withBilling = settlegridMiddleware({
 *   toolSlug: 'my-api',
 *   costCents: 5,
 * })
 *
 * export async function GET(request: Request) {
 *   return withBilling(request, async () => {
 *     return Response.json({ data: 'hello' })
 *   })
 * }
 */

import { settlegrid } from './index'
import type { PricingConfig } from './types'

export interface RestMiddlewareOptions {
  toolSlug: string
  pricing?: PricingConfig
  costCents?: number  // shorthand for per-invocation with single price
  apiUrl?: string
  debug?: boolean
  cacheTtlMs?: number
  timeoutMs?: number
}

export function settlegridMiddleware(options: RestMiddlewareOptions) {
  const pricing: PricingConfig = options.pricing ?? {
    defaultCostCents: options.costCents ?? 1,
  }

  const sg = settlegrid.init({
    toolSlug: options.toolSlug,
    pricing,
    apiUrl: options.apiUrl,
    debug: options.debug,
    cacheTtlMs: options.cacheTtlMs,
    timeoutMs: options.timeoutMs,
  })

  /**
   * Wrap a request handler with SettleGrid billing.
   * Extracts API key from request headers, validates, checks credits, meters.
   */
  return async function withBilling(
    request: Request,
    handler: () => Promise<Response> | Response,
    methodOverride?: string
  ): Promise<Response> {
    const headers: Record<string, string | string[] | undefined> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    const method = methodOverride ?? new URL(request.url).pathname.split('/').pop() ?? 'default'

    const wrappedHandler = sg.wrap(
      async () => handler(),
      { method }
    )

    try {
      return await wrappedHandler({}, { headers })
    } catch (error) {
      // Format SettleGrid errors as HTTP responses
      if (error instanceof Error) {
        if (error.constructor.name === 'InsufficientCreditsError') {
          return new Response(JSON.stringify({
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            topUpUrl: `https://settlegrid.ai/top-up?tool=${options.toolSlug}`,
          }), { status: 402, headers: { 'Content-Type': 'application/json' } })
        }
        if (error.constructor.name === 'InvalidKeyError') {
          return new Response(JSON.stringify({
            error: 'Invalid API key',
            code: 'INVALID_KEY',
          }), { status: 401, headers: { 'Content-Type': 'application/json' } })
        }
        if (error.constructor.name === 'RateLimitedError') {
          return new Response(JSON.stringify({
            error: 'Rate limited',
            code: 'RATE_LIMITED',
          }), { status: 429, headers: { 'Content-Type': 'application/json' } })
        }
      }
      throw error
    }
  }
}
```

**Add to main SDK entry point:** `/Users/lex/settlegrid/packages/mcp/src/index.ts`

Add session methods to the `SettleGridInstance` interface and `settlegrid.init()`:

```typescript
// ADD to SettleGridInstance interface:

  /** Create a workflow session with a budget */
  createSession(params: {
    budgetCents: number
    expiresIn?: number
    parentSessionId?: string
    metadata?: Record<string, unknown>
  }): Promise<{ sessionId: string; budgetCents: number; expiresAt: string }>

  /** Check if a session has sufficient budget */
  checkBudget(sessionId: string, costCents: number): Promise<{
    allowed: boolean
    availableCents: number
    reason?: string
  }>

// ADD to settlegrid.init() return object:

  async createSession(params) {
    const result = await apiCall(config, '/sessions', {
      toolSlug: config.toolSlug,
      ...params,
    })
    return result
  },

  async checkBudget(sessionId, costCents) {
    const result = await apiCall(config, `/sessions/${sessionId}/check`, {
      costCents,
    })
    return result
  },
```

---

#### Phase 2.2: MCP experimental.payment Capability

**File to create:** `/Users/lex/settlegrid/packages/mcp/src/payment-capability.ts`

```typescript
// /Users/lex/settlegrid/packages/mcp/src/payment-capability.ts

/**
 * MCP experimental.payment capability
 *
 * Defines the payment capability that MCP servers can declare and
 * clients can use to communicate billing context.
 *
 * Server declares: capabilities.experimental.payment = { ... }
 * Client sends: _meta["settlegrid-api-key"] in tool call
 * Server responds with: cost, remaining balance in _meta
 */

import type { GeneralizedPricingConfig } from './types'

/** Payment capability declaration (server -> client during initialization) */
export interface PaymentCapability {
  /** Billing provider identifier */
  provider: 'settlegrid'
  /** API version */
  version: '1.0'
  /** Pricing configuration */
  pricing: GeneralizedPricingConfig
  /** URL where consumers can purchase credits */
  topUpUrl: string
  /** URL for pricing details */
  pricingUrl?: string
  /** Accepted payment methods */
  acceptedPaymentMethods: Array<'credit-balance' | 'x402'>
}

/** Payment context in tool call _meta (client -> server) */
export interface PaymentMeta {
  /** Consumer's API key for billing */
  'settlegrid-api-key'?: string
  /** Workflow session ID for budget tracking */
  'settlegrid-session-id'?: string
  /** Maximum amount the client is willing to pay for this call */
  'settlegrid-max-cost-cents'?: number
}

/** Payment result in tool response _meta (server -> client) */
export interface PaymentResultMeta {
  /** Actual cost charged */
  'settlegrid-cost-cents': number
  /** Remaining balance after this call */
  'settlegrid-remaining-cents': number
  /** Whether this was a test/sandbox call */
  'settlegrid-test-mode'?: boolean
}

/** Standard MCP error codes for payment failures */
export const PAYMENT_ERROR_CODES = {
  INSUFFICIENT_CREDITS: -32001,
  PAYMENT_REQUIRED: -32002,
  BUDGET_EXCEEDED: -32003,
  INVALID_PAYMENT_KEY: -32004,
  PAYMENT_PROVIDER_ERROR: -32005,
} as const

/**
 * Create the payment capability object for MCP server initialization.
 *
 * @example
 * const server = new Server({
 *   capabilities: {
 *     experimental: {
 *       payment: createPaymentCapability({
 *         toolSlug: 'my-tool',
 *         pricing: { defaultCostCents: 5, methods: { search: { costCents: 10 } } },
 *       }),
 *     },
 *   },
 * })
 */
export function createPaymentCapability(options: {
  toolSlug: string
  pricing: GeneralizedPricingConfig
  topUpUrl?: string
  acceptedPaymentMethods?: Array<'credit-balance' | 'x402'>
}): PaymentCapability {
  return {
    provider: 'settlegrid',
    version: '1.0',
    pricing: options.pricing,
    topUpUrl: options.topUpUrl ?? `https://settlegrid.ai/top-up?tool=${options.toolSlug}`,
    acceptedPaymentMethods: options.acceptedPaymentMethods ?? ['credit-balance'],
  }
}
```

---

#### Phase 2.3: MCP Server Card Pricing Metadata

**File to create:** `/Users/lex/settlegrid/packages/mcp/src/server-card.ts`

```typescript
// /Users/lex/settlegrid/packages/mcp/src/server-card.ts

/**
 * MCP Server Card pricing metadata
 *
 * Defines the billing section of .well-known/mcp-server that allows
 * clients and registries to discover pricing information for MCP servers.
 */

import type { GeneralizedPricingConfig } from './types'

/** Billing metadata for MCP Server Card */
export interface ServerCardBilling {
  /** Billing provider */
  provider: 'settlegrid'
  /** Provider API URL */
  providerUrl: string
  /** Pricing model */
  model: GeneralizedPricingConfig['model']
  /** Currency (ISO 4217) */
  currency: string
  /** Per-method pricing */
  methods?: Record<string, {
    costCents: number
    displayName?: string
    description?: string
  }>
  /** Default cost (for methods not listed) */
  defaultCostCents: number
  /** URL for purchasing credits */
  topUpUrl: string
  /** Free tier (if any) */
  freeTier?: {
    invocationsPerMonth: number
    description?: string
  }
}

/** Full MCP Server Card with billing extension */
export interface MCPServerCard {
  /** Server name */
  name: string
  /** Server description */
  description: string
  /** Server version */
  version: string
  /** List of tools */
  tools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }>
  /** SettleGrid billing metadata */
  billing?: ServerCardBilling
}

/**
 * Generate the billing section for an MCP Server Card.
 *
 * @example
 * // In your .well-known/mcp-server route:
 * export function GET() {
 *   return Response.json({
 *     name: 'my-tool',
 *     description: 'A useful AI tool',
 *     version: '1.0.0',
 *     tools: [...],
 *     billing: generateServerCardBilling({
 *       toolSlug: 'my-tool',
 *       pricing: { model: 'per-invocation', defaultCostCents: 5, ... },
 *     }),
 *   })
 * }
 */
export function generateServerCardBilling(options: {
  toolSlug: string
  pricing: GeneralizedPricingConfig
  providerUrl?: string
  freeTier?: { invocationsPerMonth: number; description?: string }
}): ServerCardBilling {
  return {
    provider: 'settlegrid',
    providerUrl: options.providerUrl ?? 'https://settlegrid.ai',
    model: options.pricing.model,
    currency: options.pricing.currencyCode ?? 'USD',
    methods: options.pricing.methods
      ? Object.fromEntries(
          Object.entries(options.pricing.methods).map(([method, config]) => [
            method,
            {
              costCents: config.costCents,
              displayName: config.displayName,
            },
          ])
        )
      : undefined,
    defaultCostCents: options.pricing.defaultCostCents,
    topUpUrl: `https://settlegrid.ai/top-up?tool=${options.toolSlug}`,
    freeTier: options.freeTier,
  }
}
```

**Phase 2 test expectations:** 30+ new tests covering:
- REST middleware (8 tests: valid key, invalid key, insufficient credits, rate limited, method override, custom pricing, debug mode, timeout)
- Payment capability (5 tests: creation, validation, error codes, meta extraction, meta response)
- Server card billing (5 tests: generation, method mapping, free tier, currency, provider URL)
- SDK session methods (6 tests: createSession, checkBudget, session with parent, expired session, budget exceeded, session completion)
- SDK generalized init (6 tests: backward compatibility with PricingConfig, GeneralizedPricingConfig support, REST export, x402 export)

**Phase 2 total test count target**: 950 + 30 = **980+ tests**

---

### Phase 3: Agent Identity & KYA (2 weeks)

**Goal**: Implement Know Your Agent identity layer compatible with AgentFacts, Skyfire JWT, and DID standards. This enables SettleGrid to identify and track agents across protocols, enforce per-agent spending limits, and provide trust scores.

**Success criteria**:
- Agent identity CRUD API (register, verify, update, list)
- AgentFacts-compatible profile generation (4 of 10 categories)
- did:key (Ed25519) identity support
- Skyfire JWT token verification
- Agent wallet abstraction (credit-balance + future crypto wallets)
- Budget delegation API (parent session -> child session with agent binding)
- 45+ new tests

**Dependencies**: Phase 0 (agentIdentities table, sessions), Phase 1 (x402 for crypto wallet identity)

---

#### Phase 3.1: Agent Identity Service

**File to create:** `/Users/lex/settlegrid/apps/web/src/lib/settlement/identity.ts`

```typescript
// /Users/lex/settlegrid/apps/web/src/lib/settlement/identity.ts

import { db } from '@/lib/db'
import { agentIdentities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createHash } from 'crypto'
import { logger } from '@/lib/logger'
import type { AgentFactsProfile, IdentityType, GeneralizedPricingConfig, ProtocolName } from './types'

export interface RegisterAgentParams {
  providerId: string
  agentName: string
  identityType: IdentityType
  publicKey?: string           // Ed25519 hex for did:key
  capabilities?: {
    tools: string[]
    methods: string[]
    pricing: GeneralizedPricingConfig
    protocols: ProtocolName[]
  }
  spendingLimitCents?: number
  metadata?: Record<string, unknown>
}

export interface AgentIdentity {
  id: string
  providerId: string | null
  agentName: string
  identityType: IdentityType
  publicKey: string | null
  fingerprint: string | null
  verificationLevel: string
  capabilities: Record<string, unknown> | null
  spendingLimitCents: number | null
  status: string
  lastSeenAt: string | null
  createdAt: string
}

/**
 * Compute a fingerprint for an identity proof.
 * Used to detect duplicate registrations and enable lookup by identity.
 */
function computeFingerprint(identityType: IdentityType, value: string): string {
  return createHash('sha256')
    .update(`${identityType}:${value}`)
    .digest('hex')
}

/**
 * Register a new agent identity.
 */
export async function registerAgent(params: RegisterAgentParams): Promise<AgentIdentity> {
  const {
    providerId,
    agentName,
    identityType,
    publicKey,
    capabilities,
    spendingLimitCents,
    metadata,
  } = params

  // Compute fingerprint from identity proof
  const fingerprintSource = publicKey ?? agentName
  const fingerprint = computeFingerprint(identityType, fingerprintSource)

  // Check for duplicate
  const [existing] = await db
    .select({ id: agentIdentities.id })
    .from(agentIdentities)
    .where(eq(agentIdentities.fingerprint, fingerprint))
    .limit(1)

  if (existing) {
    throw new Error(`Agent identity already registered with fingerprint: ${fingerprint}`)
  }

  const [agent] = await db
    .insert(agentIdentities)
    .values({
      providerId,
      agentName,
      identityType,
      publicKey: publicKey ?? null,
      fingerprint,
      verificationLevel: 'none',
      capabilities: capabilities ?? null,
      spendingLimitCents: spendingLimitCents ?? null,
      status: 'active',
    })
    .returning()

  logger.info('identity.agent_registered', {
    agentId: agent.id,
    agentName,
    identityType,
    providerId,
  })

  return {
    id: agent.id,
    providerId: agent.providerId,
    agentName: agent.agentName,
    identityType: agent.identityType as IdentityType,
    publicKey: agent.publicKey,
    fingerprint: agent.fingerprint,
    verificationLevel: agent.verificationLevel,
    capabilities: agent.capabilities as Record<string, unknown> | null,
    spendingLimitCents: agent.spendingLimitCents,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
  }
}

/**
 * Look up an agent by fingerprint (identity proof hash).
 */
export async function resolveAgent(
  identityType: IdentityType,
  identityValue: string
): Promise<AgentIdentity | null> {
  const fingerprint = computeFingerprint(identityType, identityValue)

  const [agent] = await db
    .select()
    .from(agentIdentities)
    .where(and(
      eq(agentIdentities.fingerprint, fingerprint),
      eq(agentIdentities.status, 'active')
    ))
    .limit(1)

  if (!agent) return null

  // Update lastSeenAt (fire and forget)
  db.update(agentIdentities)
    .set({ lastSeenAt: new Date() })
    .where(eq(agentIdentities.id, agent.id))
    .then(() => {})
    .catch(() => {})

  return {
    id: agent.id,
    providerId: agent.providerId,
    agentName: agent.agentName,
    identityType: agent.identityType as IdentityType,
    publicKey: agent.publicKey,
    fingerprint: agent.fingerprint,
    verificationLevel: agent.verificationLevel,
    capabilities: agent.capabilities as Record<string, unknown> | null,
    spendingLimitCents: agent.spendingLimitCents,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
  }
}

/**
 * Generate an AgentFacts-compatible profile for an agent.
 * Implements 4 of the 10 AgentFacts categories.
 */
export async function generateAgentFactsProfile(agentId: string): Promise<AgentFactsProfile | null> {
  const [agent] = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.id, agentId))
    .limit(1)

  if (!agent) return null

  const capabilities = agent.capabilities as {
    tools?: string[]
    methods?: string[]
    pricing?: GeneralizedPricingConfig
    protocols?: ProtocolName[]
  } | null

  return {
    coreIdentity: {
      id: agent.fingerprint ?? agent.id,
      name: agent.agentName,
      version: '1.0.0',
      provider: agent.providerId ?? 'unknown',
      ttl: 3600, // 1 hour cache
    },
    capabilities: {
      tools: capabilities?.tools ?? [],
      methods: capabilities?.methods ?? [],
      pricing: capabilities?.pricing ?? {
        model: 'per-invocation',
        defaultCostCents: 0,
        currencyCode: 'USD',
      },
      protocols: capabilities?.protocols ?? ['mcp'],
    },
    authPermissions: {
      authTypes: [agent.identityType as IdentityType],
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerDay: 10000,
      },
      spendingLimits: {
        perSession: agent.spendingLimitCents ?? 10000,  // $100 default
        perDay: (agent.spendingLimitCents ?? 10000) * 10,
        currency: 'USD',
      },
    },
    verification: {
      level: agent.verificationLevel as AgentFactsProfile['verification']['level'],
      verifiedAt: undefined,
      trustScore: computeTrustScore(agent),
    },
  }
}

/**
 * Compute a trust score (0-100) based on agent history and verification.
 */
function computeTrustScore(agent: {
  verificationLevel: string
  createdAt: Date
  lastSeenAt: Date | null
}): number {
  let score = 10 // Base score

  // Verification level
  switch (agent.verificationLevel) {
    case 'individual': score += 40; break
    case 'business': score += 30; break
    case 'basic': score += 15; break
    default: score += 0
  }

  // Account age (up to 30 points for 90+ days)
  const ageMs = Date.now() - new Date(agent.createdAt).getTime()
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  score += Math.min(30, Math.floor(ageDays / 3))

  // Recent activity (up to 20 points)
  if (agent.lastSeenAt) {
    const lastSeenMs = Date.now() - new Date(agent.lastSeenAt).getTime()
    const lastSeenDays = lastSeenMs / (24 * 60 * 60 * 1000)
    if (lastSeenDays < 1) score += 20
    else if (lastSeenDays < 7) score += 15
    else if (lastSeenDays < 30) score += 10
    else score += 5
  }

  return Math.min(100, score)
}
```

---

#### Phase 3.2: Agent Identity API Routes

**File to create:** `/Users/lex/settlegrid/apps/web/src/app/api/agents/route.ts`

```typescript
// POST /api/agents — Register a new agent identity
// GET /api/agents — List agent identities for the authenticated provider

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { registerAgent } from '@/lib/settlement/identity'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { db } from '@/lib/db'
import { agentIdentities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const registerSchema = z.object({
  agentName: z.string().min(1).max(200),
  identityType: z.enum(['api-key', 'did:key', 'jwt', 'x509', 'tap-token']),
  publicKey: z.string().optional(),
  capabilities: z.object({
    tools: z.array(z.string()),
    methods: z.array(z.string()),
    pricing: z.record(z.unknown()),
    protocols: z.array(z.string()),
  }).optional(),
  spendingLimitCents: z.number().int().min(0).optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `agents-register:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // TODO: Extract authenticated provider ID from session/API key
    const providerId = request.headers.get('x-provider-id')
    if (!providerId) {
      return errorResponse('Provider authentication required.', 401)
    }

    const body = await parseBody(request, registerSchema)

    const agent = await registerAgent({
      providerId,
      ...body,
      capabilities: body.capabilities as any,
    })

    return successResponse(agent, 201)
  } catch (error) {
    if (error instanceof Error && error.message.includes('already registered')) {
      return errorResponse(error.message, 409)
    }
    return internalErrorResponse(error)
  }
})

export const GET = withCors(async function GET(request: NextRequest) {
  try {
    const providerId = request.headers.get('x-provider-id')
    if (!providerId) {
      return errorResponse('Provider authentication required.', 401)
    }

    const agents = await db
      .select()
      .from(agentIdentities)
      .where(eq(agentIdentities.providerId, providerId))
      .limit(100)

    return successResponse({ agents })
  } catch (error) {
    return internalErrorResponse(error)
  }
})
```

**File to create:** `/Users/lex/settlegrid/apps/web/src/app/api/agents/[id]/facts/route.ts`

```typescript
// GET /api/agents/:id/facts — Get AgentFacts profile

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { generateAgentFactsProfile } from '@/lib/settlement/identity'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 10
export { corsOptions as OPTIONS }

export const GET = withCors(async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const profile = await generateAgentFactsProfile(id)

    if (!profile) {
      return errorResponse('Agent not found.', 404)
    }

    return successResponse(profile)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
```

---

#### Phase 3.3: Budget Delegation API

**File to create:** `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/delegate/route.ts`

```typescript
// POST /api/sessions/:id/delegate — Delegate budget to a child session

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { createSession } from '@/lib/settlement/sessions'
import { db } from '@/lib/db'
import { workflowSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const delegateSchema = z.object({
  budgetCents: z.number().int().min(1),
  agentId: z.string().uuid().optional(),
  expiresIn: z.number().int().min(1).max(86400).optional(), // max 24h
  metadata: z.record(z.unknown()).optional(),
})

export const POST = withCors(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `session-delegate:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id: parentSessionId } = await params
    const body = await parseBody(request, delegateSchema)

    // Get parent session to determine customerId
    const [parent] = await db
      .select({ customerId: workflowSessions.customerId })
      .from(workflowSessions)
      .where(eq(workflowSessions.id, parentSessionId))
      .limit(1)

    if (!parent) {
      return errorResponse('Parent session not found.', 404)
    }

    const childSession = await createSession({
      customerId: parent.customerId,
      budgetCents: body.budgetCents,
      expiresIn: body.expiresIn,
      parentSessionId,
      metadata: {
        ...body.metadata,
        agentId: body.agentId,
        delegatedFrom: parentSessionId,
      },
    })

    return successResponse(childSession, 201)
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('exceeds') ||
      error.message.includes('not active') ||
      error.message.includes('cannot expire')
    )) {
      return errorResponse(error.message, 400)
    }
    return internalErrorResponse(error)
  }
})
```

**Phase 3 test expectations:** 45+ new tests covering:
- registerAgent (6 tests: success, duplicate, with publicKey, with capabilities, with spending limit, invalid provider)
- resolveAgent (4 tests: by fingerprint, not found, inactive agent, updates lastSeenAt)
- generateAgentFactsProfile (5 tests: all 4 categories populated, null agent, trust score computation)
- computeTrustScore (5 tests: verification levels, account age, recent activity, max score cap, new account)
- computeFingerprint (3 tests: deterministic, different types produce different fingerprints, consistent)
- Agent API routes (8 tests: POST register, GET list, GET facts, 401 without provider, 409 duplicate, 404 unknown agent)
- Budget delegation (8 tests: successful delegation, exceeds parent budget, parent inactive, child after parent expiry, nested delegation, delegation spend rollup, complete releases budget, concurrent delegations)
- Skyfire JWT verification (6 tests: valid JWT, expired JWT, invalid signature, extract claims, kya token type, pay token type)

**Phase 3 total test count target**: 980 + 45 = **1025+ tests**

---

## Implementation Schedule Summary (Phases 0-3)

| Phase | Duration | New Tests | Cumulative Tests | Key Deliverables |
|-------|----------|-----------|------------------|-----------------|
| 0: Foundation Refactor | 2 weeks | 78+ | 910+ | Generalized types, pricing model, double-entry ledger, workflow sessions, MCP adapter, 7 new DB tables |
| 1: x402 Facilitator | 2 weeks | 40+ | 950+ | x402 verify/settle endpoints, EIP-3009 + Permit2 support, X402Adapter, gas management, receipts |
| 2: MCP Payment SEP | 2 weeks | 30+ | 980+ | Generalized SDK, REST middleware, experimental.payment capability, Server Card billing, SEP draft |
| 3: Agent Identity & KYA | 2 weeks | 45+ | 1025+ | Agent registration, AgentFacts profiles, did:key + JWT support, budget delegation, trust scoring |

**Total timeline for first half**: 8 weeks
**Total new tests**: 193+
**Total test count**: 1025+
**New DB tables**: 7
**New API routes**: ~15
**New lib modules**: ~12
<!-- Phases 4-8: Advanced Capabilities -->

> **Existing codebase reference**: The current schema lives at `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts` with 16 tables (developers, tools, consumers, consumerToolBalances, apiKeys, invocations, purchases, payouts, webhookEndpoints, webhookDeliveries, auditLogs, toolReviews, toolChangelogs, conversionEvents, consumerAlerts, toolHealthChecks, referrals, developerReputation, waitlistSignups). The SDK package lives at `/Users/lex/settlegrid/packages/mcp/`. Redis metering is in `/Users/lex/settlegrid/apps/web/src/lib/metering.ts`. All API routes are under `/Users/lex/settlegrid/apps/web/src/app/api/`.

---

## Phase 4: Workflow Sessions & Multi-Hop Settlement (2 weeks)

**Goal**: Solve the multi-hop problem that NO competitor addresses -- atomic settlement across multi-agent workflows. When Agent A calls Tool B which calls Tool C which calls Tool D, every participant must get paid atomically or not at all.

### 4.1 Database Schema Extensions

**File**: `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts`

Add the following tables after the existing `waitlistSignups` table:

```typescript
// ---- Workflow Sessions -------------------------------------------------------

export const workflowSessions = pgTable(
  'workflow_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    parentSessionId: uuid('parent_session_id'), // self-reference for delegated sub-sessions
    budgetCents: integer('budget_cents').notNull(),
    spentCents: integer('spent_cents').notNull().default(0),
    reservedCents: integer('reserved_cents').notNull().default(0), // held for delegated sub-sessions
    settlementMode: text('settlement_mode').notNull().default('immediate'),
      // 'immediate' | 'deferred' | 'atomic'
    status: text('status').notNull().default('active'),
      // 'active' | 'finalizing' | 'settled' | 'failed' | 'expired' | 'cancelled'
    hops: jsonb('hops').notNull().default('[]'),
      // Array<{ hopId: string; serviceId: string; toolId: string; method: string;
      //   costCents: number; timestamp: string; status: 'pending' | 'success' | 'failed';
      //   latencyMs: number | null; metadata: Record<string, unknown> | null }>
    delegatedAgentId: text('delegated_agent_id'), // agent this sub-session was delegated to
    delegatedBySessionId: uuid('delegated_by_session_id'), // parent that delegated
    atomicSettlementId: uuid('atomic_settlement_id')
      .references(() => settlementBatches.id, { onDelete: 'set null' }),
    sessionApiKeyHash: text('session_api_key_hash'), // for session-scoped keys
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    metadata: jsonb('metadata'), // caller-supplied metadata, max 4KB
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workflow_sessions_consumer_id_idx').on(table.consumerId),
    index('workflow_sessions_parent_session_id_idx').on(table.parentSessionId),
    index('workflow_sessions_status_idx').on(table.status),
    index('workflow_sessions_expires_at_idx').on(table.expiresAt),
    index('workflow_sessions_atomic_settlement_idx').on(table.atomicSettlementId),
  ]
)

export const workflowSessionsRelations = relations(workflowSessions, ({ one, many }) => ({
  consumer: one(consumers, {
    fields: [workflowSessions.consumerId],
    references: [consumers.id],
  }),
  parentSession: one(workflowSessions, {
    fields: [workflowSessions.parentSessionId],
    references: [workflowSessions.id],
    relationName: 'parentChild',
  }),
  childSessions: many(workflowSessions, { relationName: 'parentChild' }),
  settlementBatch: one(settlementBatches, {
    fields: [workflowSessions.atomicSettlementId],
    references: [settlementBatches.id],
  }),
}))

// ---- Settlement Batches ------------------------------------------------------

export const settlementBatches = pgTable(
  'settlement_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull(),
      // references workflowSessions.id but not FK to avoid circular
    totalAmountCents: integer('total_amount_cents').notNull(),
    platformFeeCents: integer('platform_fee_cents').notNull(),
    status: text('status').notNull().default('pending'),
      // 'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back'
    disbursements: jsonb('disbursements').notNull().default('[]'),
      // Array<{ developerId: string; toolId: string; amountCents: number;
      //   platformFeeCents: number; stripeTransferId: string | null;
      //   status: 'pending' | 'completed' | 'failed' }>
    rollbackReason: text('rollback_reason'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('settlement_batches_session_id_idx').on(table.sessionId),
    index('settlement_batches_status_idx').on(table.status),
  ]
)
```

**Drizzle migration command** (run from `/Users/lex/settlegrid`):
```bash
cd /Users/lex/settlegrid && npx drizzle-kit generate --name add-workflow-sessions
cd /Users/lex/settlegrid && npx drizzle-kit push
```

### 4.2 TypeScript Types for Workflow Sessions

**File**: `/Users/lex/settlegrid/apps/web/src/lib/types/sessions.ts` (new file)

```typescript
export type SettlementMode = 'immediate' | 'deferred' | 'atomic'

export type SessionStatus =
  | 'active'
  | 'finalizing'
  | 'settled'
  | 'failed'
  | 'expired'
  | 'cancelled'

export interface SessionHop {
  hopId: string
  serviceId: string
  toolId: string
  method: string
  costCents: number
  timestamp: string // ISO 8601
  status: 'pending' | 'success' | 'failed'
  latencyMs: number | null
  metadata: Record<string, unknown> | null
}

export interface SessionDisbursement {
  developerId: string
  toolId: string
  amountCents: number
  platformFeeCents: number
  stripeTransferId: string | null
  status: 'pending' | 'completed' | 'failed'
}

export type BatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rolled_back'

export interface CreateSessionInput {
  budgetCents: number
  expiresIn: string // e.g. '1h', '30m', '24h'
  settlementMode: SettlementMode
  metadata?: Record<string, unknown>
}

export interface RecordHopInput {
  serviceId: string
  toolId: string
  method: string
  costCents: number
  latencyMs?: number
  metadata?: Record<string, unknown>
}

export interface DelegateBudgetInput {
  agentId: string
  budgetCents: number
  expiresIn: string
}
```

### 4.3 Session Lifecycle Engine

**File**: `/Users/lex/settlegrid/apps/web/src/lib/sessions.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { workflowSessions, settlementBatches, consumers, tools, developers } from '@/lib/db/schema'
import { eq, and, sql, lt } from 'drizzle-orm'
import { getRedis, tryRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'
import type {
  SessionHop,
  SessionDisbursement,
  SettlementMode,
  CreateSessionInput,
  RecordHopInput,
  DelegateBudgetInput,
} from '@/lib/types/sessions'

// ---- Redis Keys for Session State --------------------------------------------

function sessionBudgetKey(sessionId: string): string {
  return `session:budget:${sessionId}`
}

function sessionSpentKey(sessionId: string): string {
  return `session:spent:${sessionId}`
}

function sessionReservedKey(sessionId: string): string {
  return `session:reserved:${sessionId}`
}

function sessionLockKey(sessionId: string): string {
  return `session:lock:${sessionId}`
}

// ---- Duration Parsing -------------------------------------------------------

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(m|h|d)$/)
  if (!match) throw new Error(`Invalid duration format: ${duration}. Use e.g. '30m', '1h', '24h'.`)
  const value = parseInt(match[1], 10)
  const unit = match[2]
  switch (unit) {
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: throw new Error(`Unknown duration unit: ${unit}`)
  }
}

// ---- Create Session ---------------------------------------------------------

export async function createSession(
  consumerId: string,
  input: CreateSessionInput
): Promise<{ sessionId: string; sessionApiKey: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + parseDuration(input.expiresIn))

  // Generate a session-scoped API key
  const sessionApiKey = `sg_session_${randomUUID().replace(/-/g, '')}`
  const sessionApiKeyHash = (await import('crypto')).createHash('sha256')
    .update(sessionApiKey).digest('hex')

  const [session] = await db
    .insert(workflowSessions)
    .values({
      consumerId,
      budgetCents: input.budgetCents,
      settlementMode: input.settlementMode,
      expiresAt,
      sessionApiKeyHash,
      metadata: input.metadata ?? null,
      hops: [],
    })
    .returning({ id: workflowSessions.id })

  // Hydrate session budget to Redis for fast hop authorization
  const redis = getRedis()
  const ttlSec = Math.ceil(parseDuration(input.expiresIn) / 1000)
  await Promise.all([
    tryRedis(() => redis.set(sessionBudgetKey(session.id), input.budgetCents, { ex: ttlSec })),
    tryRedis(() => redis.set(sessionSpentKey(session.id), 0, { ex: ttlSec })),
    tryRedis(() => redis.set(sessionReservedKey(session.id), 0, { ex: ttlSec })),
  ])

  logger.info('session.created', {
    sessionId: session.id,
    consumerId,
    budgetCents: input.budgetCents,
    settlementMode: input.settlementMode,
    expiresAt: expiresAt.toISOString(),
  })

  return { sessionId: session.id, sessionApiKey, expiresAt }
}

// ---- Record Hop (service call within session) --------------------------------

export async function recordHop(
  sessionId: string,
  input: RecordHopInput
): Promise<{ hopId: string; remainingBudgetCents: number }> {
  const redis = getRedis()

  // Atomic budget check via Redis: INCRBY spent, check against budget
  const spent = await tryRedis(() => redis.incrby(sessionSpentKey(sessionId), input.costCents))
  const budget = await tryRedis(() => redis.get<number>(sessionBudgetKey(sessionId)))
  const reserved = await tryRedis(() => redis.get<number>(sessionReservedKey(sessionId)))

  if (spent === null || budget === null) {
    // Fallback to DB
    const [session] = await db
      .select({
        budgetCents: workflowSessions.budgetCents,
        spentCents: workflowSessions.spentCents,
        reservedCents: workflowSessions.reservedCents,
        status: workflowSessions.status,
      })
      .from(workflowSessions)
      .where(eq(workflowSessions.id, sessionId))
      .limit(1)

    if (!session || session.status !== 'active') {
      throw new Error('Session not found or not active')
    }

    const availableCents = session.budgetCents - session.spentCents - session.reservedCents
    if (input.costCents > availableCents) {
      throw new Error(`Insufficient session budget: need ${input.costCents}, available ${availableCents}`)
    }
  } else {
    const effectiveReserved = reserved ?? 0
    const available = budget - spent - effectiveReserved
    // We already incremented spent; if insufficient, roll back
    if (available < 0) {
      await tryRedis(() => redis.decrby(sessionSpentKey(sessionId), input.costCents))
      throw new Error(
        `Insufficient session budget: need ${input.costCents}, ` +
        `available ${budget - (spent - input.costCents) - effectiveReserved}`
      )
    }
  }

  const hopId = randomUUID()
  const hop: SessionHop = {
    hopId,
    serviceId: input.serviceId,
    toolId: input.toolId,
    method: input.method,
    costCents: input.costCents,
    timestamp: new Date().toISOString(),
    status: 'success',
    latencyMs: input.latencyMs ?? null,
    metadata: input.metadata ?? null,
  }

  // Append hop to DB session (JSONB append)
  await db
    .update(workflowSessions)
    .set({
      hops: sql`${workflowSessions.hops} || ${JSON.stringify([hop])}::jsonb`,
      spentCents: sql`${workflowSessions.spentCents} + ${input.costCents}`,
      updatedAt: new Date(),
    })
    .where(eq(workflowSessions.id, sessionId))

  const effectiveBudget = budget ?? 0
  const effectiveSpent = spent ?? input.costCents
  const effectiveReserved = reserved ?? 0

  return {
    hopId,
    remainingBudgetCents: effectiveBudget - effectiveSpent - effectiveReserved,
  }
}

// ---- Delegate Sub-Budget ----------------------------------------------------

export async function delegateBudget(
  sessionId: string,
  input: DelegateBudgetInput
): Promise<{ subSessionId: string; subSessionApiKey: string; expiresAt: Date }> {
  const redis = getRedis()

  // Increment reserved in parent session
  const reserved = await tryRedis(() =>
    redis.incrby(sessionReservedKey(sessionId), input.budgetCents)
  )
  const budget = await tryRedis(() => redis.get<number>(sessionBudgetKey(sessionId)))
  const spent = await tryRedis(() => redis.get<number>(sessionSpentKey(sessionId)))

  if (reserved !== null && budget !== null && spent !== null) {
    if (spent + reserved > budget) {
      // Roll back
      await tryRedis(() => redis.decrby(sessionReservedKey(sessionId), input.budgetCents))
      throw new Error('Insufficient budget to delegate')
    }
  }

  // Update parent session in DB
  await db
    .update(workflowSessions)
    .set({
      reservedCents: sql`${workflowSessions.reservedCents} + ${input.budgetCents}`,
      updatedAt: new Date(),
    })
    .where(eq(workflowSessions.id, sessionId))

  // Get parent session's consumerId
  const [parent] = await db
    .select({ consumerId: workflowSessions.consumerId })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!parent) throw new Error('Parent session not found')

  const expiresAt = new Date(Date.now() + parseDuration(input.expiresIn))
  const subSessionApiKey = `sg_session_${randomUUID().replace(/-/g, '')}`
  const subSessionApiKeyHash = (await import('crypto')).createHash('sha256')
    .update(subSessionApiKey).digest('hex')

  const [subSession] = await db
    .insert(workflowSessions)
    .values({
      consumerId: parent.consumerId,
      parentSessionId: sessionId,
      budgetCents: input.budgetCents,
      settlementMode: 'atomic', // sub-sessions always settle atomically with parent
      expiresAt,
      sessionApiKeyHash: subSessionApiKeyHash,
      delegatedAgentId: input.agentId,
      delegatedBySessionId: sessionId,
      hops: [],
    })
    .returning({ id: workflowSessions.id })

  // Hydrate sub-session to Redis
  const ttlSec = Math.ceil(parseDuration(input.expiresIn) / 1000)
  await Promise.all([
    tryRedis(() => redis.set(sessionBudgetKey(subSession.id), input.budgetCents, { ex: ttlSec })),
    tryRedis(() => redis.set(sessionSpentKey(subSession.id), 0, { ex: ttlSec })),
    tryRedis(() => redis.set(sessionReservedKey(subSession.id), 0, { ex: ttlSec })),
  ])

  logger.info('session.delegated', {
    parentSessionId: sessionId,
    subSessionId: subSession.id,
    agentId: input.agentId,
    budgetCents: input.budgetCents,
  })

  return { subSessionId: subSession.id, subSessionApiKey, expiresAt }
}

// ---- Finalize Session (triggers settlement) ---------------------------------

export async function finalizeSession(
  sessionId: string
): Promise<{ batchId: string | null; totalSettledCents: number }> {
  // Mark session as finalizing
  await db
    .update(workflowSessions)
    .set({ status: 'finalizing', finalizedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(workflowSessions.id, sessionId),
      eq(workflowSessions.status, 'active'),
    ))

  // Get the session with all hops
  const [session] = await db
    .select()
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) throw new Error('Session not found')
  if (session.status !== 'finalizing') throw new Error(`Session status is ${session.status}, expected finalizing`)

  const hops = (session.hops as SessionHop[]).filter(h => h.status === 'success')

  if (session.settlementMode === 'immediate') {
    // Already settled per-hop; just mark complete
    await db
      .update(workflowSessions)
      .set({ status: 'settled', settledAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowSessions.id, sessionId))
    return { batchId: null, totalSettledCents: session.spentCents }
  }

  // For 'deferred' or 'atomic' mode, create a settlement batch
  const disbursementMap = new Map<string, { toolId: string; amountCents: number }>()

  for (const hop of hops) {
    const key = hop.toolId
    const existing = disbursementMap.get(key)
    if (existing) {
      existing.amountCents += hop.costCents
    } else {
      disbursementMap.set(key, { toolId: hop.toolId, amountCents: hop.costCents })
    }
  }

  // Look up developer IDs and revenue share for each tool
  const toolIds = [...new Set(hops.map(h => h.toolId))]
  const toolRows = toolIds.length > 0
    ? await db
        .select({
          toolId: tools.id,
          developerId: tools.developerId,
        })
        .from(tools)
        .where(sql`${tools.id} IN (${sql.join(toolIds.map(id => sql`${id}::uuid`), sql`, `)})`)
    : []

  const developerRows = toolRows.length > 0
    ? await db
        .select({
          developerId: developers.id,
          revenueSharePct: developers.revenueSharePct,
        })
        .from(developers)
        .where(sql`${developers.id} IN (${sql.join(
          [...new Set(toolRows.map(t => t.developerId))].map(id => sql`${id}::uuid`),
          sql`, `
        )})`)
    : []

  const devMap = new Map(developerRows.map(d => [d.developerId, d.revenueSharePct]))
  const toolDevMap = new Map(toolRows.map(t => [t.toolId, t.developerId]))

  const disbursements: SessionDisbursement[] = []
  let totalPlatformFee = 0

  for (const [, entry] of disbursementMap) {
    const developerId = toolDevMap.get(entry.toolId)
    if (!developerId) continue

    const revSharePct = devMap.get(developerId) ?? 85
    const platformFeeCents = Math.ceil(entry.amountCents * ((100 - revSharePct) / 100))
    const developerAmountCents = entry.amountCents - platformFeeCents

    totalPlatformFee += platformFeeCents

    disbursements.push({
      developerId,
      toolId: entry.toolId,
      amountCents: developerAmountCents,
      platformFeeCents,
      stripeTransferId: null,
      status: 'pending',
    })
  }

  const totalAmount = hops.reduce((sum, h) => sum + h.costCents, 0)

  // Create settlement batch inside a transaction
  const [batch] = await db
    .insert(settlementBatches)
    .values({
      sessionId,
      totalAmountCents: totalAmount,
      platformFeeCents: totalPlatformFee,
      disbursements,
    })
    .returning({ id: settlementBatches.id })

  // Link session to batch and mark settled
  await db
    .update(workflowSessions)
    .set({
      atomicSettlementId: batch.id,
      status: 'settled',
      settledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowSessions.id, sessionId))

  // Process disbursements: credit each developer's balance
  for (const d of disbursements) {
    await db
      .update(developers)
      .set({
        balanceCents: sql`${developers.balanceCents} + ${d.amountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, d.developerId))
  }

  // Mark batch as completed
  await db
    .update(settlementBatches)
    .set({
      status: 'completed',
      processedAt: new Date(),
      disbursements: disbursements.map(d => ({ ...d, status: 'completed' as const })),
    })
    .where(eq(settlementBatches.id, batch.id))

  logger.info('session.settled', {
    sessionId,
    batchId: batch.id,
    totalSettledCents: totalAmount,
    disbursementCount: disbursements.length,
  })

  // Clean up Redis
  const redis = getRedis()
  await Promise.all([
    tryRedis(() => redis.del(sessionBudgetKey(sessionId))),
    tryRedis(() => redis.del(sessionSpentKey(sessionId))),
    tryRedis(() => redis.del(sessionReservedKey(sessionId))),
  ])

  return { batchId: batch.id, totalSettledCents: totalAmount }
}

// ---- Expire Stale Sessions (cron) -------------------------------------------

export async function expireStaleSessionsBatch(): Promise<number> {
  const now = new Date()
  const stale = await db
    .select({ id: workflowSessions.id })
    .from(workflowSessions)
    .where(and(
      eq(workflowSessions.status, 'active'),
      lt(workflowSessions.expiresAt, now),
    ))
    .limit(100)

  for (const s of stale) {
    await db
      .update(workflowSessions)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(workflowSessions.id, s.id))

    // Clean up Redis
    const redis = getRedis()
    await Promise.all([
      tryRedis(() => redis.del(sessionBudgetKey(s.id))),
      tryRedis(() => redis.del(sessionSpentKey(s.id))),
      tryRedis(() => redis.del(sessionReservedKey(s.id))),
    ])
  }

  if (stale.length > 0) {
    logger.info('session.expired_batch', { count: stale.length })
  }

  return stale.length
}
```

### 4.4 API Routes for Workflow Sessions

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession } from '@/lib/sessions'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 10

const createSessionSchema = z.object({
  consumerId: z.string().uuid(),
  budgetCents: z.number().int().min(1).max(10_000_000), // max $100K per session
  expiresIn: z.string().regex(/^\d+(m|h|d)$/),
  settlementMode: z.enum(['immediate', 'deferred', 'atomic']),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `sessions:create:${ip}`)
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = createSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await createSession(parsed.data.consumerId, parsed.data)

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    logger.error('api.sessions.create_failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workflowSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 10

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await checkRateLimit(apiLimiter, `sessions:get:${ip}`)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const [session] = await db
    .select()
    .from(workflowSessions)
    .where(eq(workflowSessions.id, id))
    .limit(1)

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: session.id,
    consumerId: session.consumerId,
    parentSessionId: session.parentSessionId,
    budgetCents: session.budgetCents,
    spentCents: session.spentCents,
    reservedCents: session.reservedCents,
    remainingCents: session.budgetCents - session.spentCents - session.reservedCents,
    settlementMode: session.settlementMode,
    status: session.status,
    hops: session.hops,
    hopCount: Array.isArray(session.hops) ? (session.hops as unknown[]).length : 0,
    expiresAt: session.expiresAt,
    finalizedAt: session.finalizedAt,
    settledAt: session.settledAt,
    createdAt: session.createdAt,
  })
}
```

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/hop/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { recordHop } from '@/lib/sessions'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 10

const hopSchema = z.object({
  serviceId: z.string().min(1).max(256),
  toolId: z.string().uuid(),
  method: z.string().min(1).max(128),
  costCents: z.number().int().min(0).max(1_000_000),
  latencyMs: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `sessions:hop:${ip}`)
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = hopSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await recordHop(id, parsed.data)

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message.includes('Insufficient session budget')) {
      return NextResponse.json({ error: message }, { status: 402 })
    }
    logger.error('api.sessions.hop_failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/finalize/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { finalizeSession } from '@/lib/sessions'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30 // settlement can take longer

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `sessions:finalize:${ip}`)
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    const result = await finalizeSession(id)

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    logger.error('api.sessions.finalize_failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/sessions/[id]/delegate/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { delegateBudget } from '@/lib/sessions'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 10

const delegateSchema = z.object({
  agentId: z.string().min(1).max(256),
  budgetCents: z.number().int().min(1).max(10_000_000),
  expiresIn: z.string().regex(/^\d+(m|h|d)$/),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `sessions:delegate:${ip}`)
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = delegateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await delegateBudget(id, parsed.data)

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    logger.error('api.sessions.delegate_failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 4.5 Session Expiry Cron

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/cron/session-expiry/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { expireStaleSessionsBatch } from '@/lib/sessions'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const cronSecret = getCronSecret()
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const expired = await expireStaleSessionsBatch()
    return NextResponse.json({ expired })
  } catch (err) {
    logger.error('cron.session_expiry_failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

Add to `vercel.json` crons (if not already present):
```json
{
  "crons": [
    { "path": "/api/cron/session-expiry", "schedule": "*/5 * * * *" }
  ]
}
```

### 4.6 SDK Extensions for Workflow Sessions

**File**: `/Users/lex/settlegrid/packages/mcp/src/sessions.ts` (new file)

```typescript
import type { NormalizedConfig } from './config'

export interface SessionConfig {
  budgetCents: number
  expiresIn: string
  settlementMode: 'immediate' | 'deferred' | 'atomic'
  metadata?: Record<string, unknown>
}

export interface SessionHopResult {
  hopId: string
  remainingBudgetCents: number
}

export interface SessionFinalizeResult {
  batchId: string | null
  totalSettledCents: number
}

export interface DelegateConfig {
  agentId: string
  budgetCents: number
  expiresIn: string
}

export interface WorkflowSession {
  id: string
  sessionApiKey: string
  expiresAt: Date

  /** Record a service call (hop) within this session */
  call<TResult>(
    toolSlug: string,
    options: { method: string; costCents: number; args?: unknown },
    handler: () => Promise<TResult> | TResult
  ): Promise<TResult>

  /** Delegate a sub-budget to another agent */
  delegate(config: DelegateConfig): Promise<WorkflowSession>

  /** Finalize the session and trigger atomic settlement */
  finalize(): Promise<SessionFinalizeResult>

  /** Get current session status */
  status(): Promise<{
    budgetCents: number
    spentCents: number
    remainingCents: number
    hopCount: number
    status: string
  }>
}

/**
 * Create a workflow session client.
 * This is called from settlegrid.createSession() in the main SDK.
 */
export function createSessionClient(
  config: NormalizedConfig,
  consumerId: string,
  sessionConfig: SessionConfig
): {
  create: () => Promise<WorkflowSession>
} {
  async function apiCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${config.apiUrl}/api/sessions${path}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Session API returned ${res.status}`)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timeout)
    }
  }

  async function apiGet<T>(path: string): Promise<T> {
    const url = `${config.apiUrl}/api/sessions${path}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`Session API returned ${res.status}`)
      return (await res.json()) as T
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    async create(): Promise<WorkflowSession> {
      const result = await apiCall<{
        sessionId: string
        sessionApiKey: string
        expiresAt: string
      }>('', {
        consumerId,
        budgetCents: sessionConfig.budgetCents,
        expiresIn: sessionConfig.expiresIn,
        settlementMode: sessionConfig.settlementMode,
        metadata: sessionConfig.metadata,
      })

      const sessionId = result.sessionId

      const session: WorkflowSession = {
        id: sessionId,
        sessionApiKey: result.sessionApiKey,
        expiresAt: new Date(result.expiresAt),

        async call<TResult>(
          toolSlug: string,
          options: { method: string; costCents: number; args?: unknown },
          handler: () => Promise<TResult> | TResult
        ): Promise<TResult> {
          // Execute the handler first
          const startTime = Date.now()
          const handlerResult = await handler()
          const latencyMs = Date.now() - startTime

          // Record the hop
          await apiCall<SessionHopResult>(`/${sessionId}/hop`, {
            serviceId: toolSlug,
            toolId: toolSlug,
            method: options.method,
            costCents: options.costCents,
            latencyMs,
          })

          return handlerResult
        },

        async delegate(delegateConfig: DelegateConfig): Promise<WorkflowSession> {
          const subResult = await apiCall<{
            subSessionId: string
            subSessionApiKey: string
            expiresAt: string
          }>(`/${sessionId}/delegate`, delegateConfig)

          // Recursively create a session client for the sub-session
          const subSessionClient = createSessionClient(config, consumerId, {
            budgetCents: delegateConfig.budgetCents,
            expiresIn: delegateConfig.expiresIn,
            settlementMode: 'atomic',
          })

          // Return a session object that points to the sub-session
          const subSession = await subSessionClient.create()
          return {
            ...subSession,
            id: subResult.subSessionId,
            sessionApiKey: subResult.subSessionApiKey,
            expiresAt: new Date(subResult.expiresAt),
          }
        },

        async finalize(): Promise<SessionFinalizeResult> {
          return apiCall<SessionFinalizeResult>(`/${sessionId}/finalize`, {})
        },

        async status() {
          return apiGet<{
            budgetCents: number
            spentCents: number
            remainingCents: number
            hopCount: number
            status: string
          }>(`/${sessionId}`)
        },
      }

      return session
    },
  }
}
```

**Update** `/Users/lex/settlegrid/packages/mcp/src/index.ts` to export session support:

Add after the existing `settlegrid` export:

```typescript
import { createSessionClient } from './sessions'
import type { SessionConfig, WorkflowSession } from './sessions'

// Add to SettleGridInstance interface:
//   createSession(consumerId: string, config: SessionConfig): Promise<WorkflowSession>

// Add to the init() return object:
//   async createSession(consumerId: string, sessionConfig: SessionConfig) {
//     const client = createSessionClient(config, consumerId, sessionConfig)
//     return client.create()
//   }

export type { SessionConfig, WorkflowSession }
```

### 4.7 Tests for Workflow Sessions

**File**: `/Users/lex/settlegrid/apps/web/src/lib/__tests__/sessions.test.ts` (new file)

Write tests covering:
1. `createSession` -- creates session, returns API key, hydrates Redis
2. `recordHop` -- deducts from budget, appends hop to JSONB array, rejects when over budget
3. `delegateBudget` -- reserves budget in parent, creates child session, rejects when insufficient
4. `finalizeSession` -- creates settlement batch, credits developers, marks settled
5. `expireStaleSessionsBatch` -- expires sessions past expiresAt, cleans Redis
6. Atomic settlement -- all disbursements succeed or all roll back
7. Nested delegation -- parent -> child -> grandchild budget flow
8. Session-scoped API key validation

Target: 40+ test cases.

---

## Phase 5: Enterprise Features (3 weeks)

**Goal**: Build enterprise-grade features that unlock $299/mo Platform and custom Enterprise tiers. Multi-tenancy, chargeback, compliance, white-label.

### 5.1 Database Schema: Organizations & Multi-Tenancy

**File**: `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts`

Add after the workflow session tables:

```typescript
// ---- Organizations -----------------------------------------------------------

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    plan: text('plan').notNull().default('free'),
      // 'free' | 'builder' | 'scale' | 'platform' | 'enterprise'
    billingEmail: text('billing_email').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    settings: jsonb('settings').notNull().default('{}'),
      // { defaultBudgetCents?: number; requireApproval?: boolean;
      //   allowedIps?: string[]; ssoEnabled?: boolean; ssoProvider?: string }
    monthlyBudgetCents: integer('monthly_budget_cents'), // null = unlimited
    currentMonthSpendCents: integer('current_month_spend_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('organizations_slug_idx').on(table.slug),
    index('organizations_plan_idx').on(table.plan),
  ]
)

// ---- Organization Members ----------------------------------------------------

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(), // references consumers.id or developers.id
    userType: text('user_type').notNull(), // 'consumer' | 'developer'
    role: text('role').notNull().default('member'),
      // 'owner' | 'admin' | 'member' | 'viewer' | 'billing'
    departmentTag: text('department_tag'), // for cost allocation: 'engineering', 'marketing', etc.
    personalBudgetCents: integer('personal_budget_cents'), // null = org default
    invitedBy: uuid('invited_by'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('org_members_org_id_idx').on(table.orgId),
    index('org_members_user_id_idx').on(table.userId),
    uniqueIndex('org_members_org_user_idx').on(table.orgId, table.userId),
  ]
)

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.orgId],
    references: [organizations.id],
  }),
}))

// ---- Cost Allocations --------------------------------------------------------

export const costAllocations = pgTable(
  'cost_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    departmentTag: text('department_tag').notNull(),
    serviceId: text('service_id'), // tool slug or null for unattributed
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    totalCents: integer('total_cents').notNull().default(0),
    operationCount: integer('operation_count').notNull().default(0),
    metadata: jsonb('metadata'), // { topMethods: [...], peakHour: 14, avgCostCents: 2 }
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cost_allocations_org_id_idx').on(table.orgId),
    index('cost_allocations_period_idx').on(table.periodStart, table.periodEnd),
    uniqueIndex('cost_alloc_org_dept_period_idx').on(
      table.orgId, table.departmentTag, table.periodStart
    ),
  ]
)

// ---- White-Label Configurations ----------------------------------------------

export const whitelabelConfigs = pgTable(
  'whitelabel_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    domain: text('domain'), // custom domain for billing portal
    brandName: text('brand_name').notNull(),
    logoUrl: text('logo_url'),
    primaryColor: text('primary_color').notNull().default('#10B981'), // Emerald Green
    secondaryColor: text('secondary_color'),
    cssOverrides: text('css_overrides'), // raw CSS for advanced customization
    apiKeyPrefix: text('api_key_prefix'), // custom prefix e.g. 'mycompany' instead of 'sg'
    emailFromName: text('email_from_name'),
    emailFromAddress: text('email_from_address'),
    footerText: text('footer_text'),
    faviconUrl: text('favicon_url'),
    status: text('status').notNull().default('active'), // 'active' | 'pending_verification' | 'disabled'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('whitelabel_org_id_idx').on(table.orgId),
    index('whitelabel_domain_idx').on(table.domain),
  ]
)

// ---- Compliance Data Exports -------------------------------------------------

export const complianceExports = pgTable(
  'compliance_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestedBy: uuid('requested_by').notNull(), // consumer or developer ID
    requestType: text('request_type').notNull(), // 'data_export' | 'data_deletion' | 'audit_report'
    status: text('status').notNull().default('pending'),
      // 'pending' | 'processing' | 'completed' | 'failed'
    exportUrl: text('export_url'), // signed URL for download
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // signed URL expiry
    metadata: jsonb('metadata'), // { recordCount: 1234, sizeBytes: 56789 }
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('compliance_exports_requested_by_idx').on(table.requestedBy),
    index('compliance_exports_status_idx').on(table.status),
  ]
)

// ---- Usage Aggregations (pre-computed) ---------------------------------------

export const usageAggregations = pgTable(
  'usage_aggregations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: text('entity_id').notNull(), // developer ID, consumer ID, org ID, or tool ID
    entityType: text('entity_type').notNull(), // 'developer' | 'consumer' | 'org' | 'tool'
    period: text('period').notNull(), // 'daily' | 'weekly' | 'monthly'
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    totalOperations: integer('total_operations').notNull().default(0),
    totalRevenueCents: integer('total_revenue_cents').notNull().default(0),
    totalCostCents: integer('total_cost_cents').notNull().default(0),
    uniqueConsumers: integer('unique_consumers').notNull().default(0),
    uniqueTools: integer('unique_tools').notNull().default(0),
    avgLatencyMs: integer('avg_latency_ms'),
    p95LatencyMs: integer('p95_latency_ms'),
    errorRate: integer('error_rate'), // basis points (100 = 1%)
    topMethods: jsonb('top_methods'), // [{ method: string, count: number }]
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('usage_agg_entity_idx').on(table.entityId, table.entityType),
    index('usage_agg_period_idx').on(table.period, table.periodStart),
    uniqueIndex('usage_agg_unique_idx').on(
      table.entityId, table.entityType, table.period, table.periodStart
    ),
  ]
)
```

### 5.2 Organization Management Library

**File**: `/Users/lex/settlegrid/apps/web/src/lib/organizations.ts` (new file)

```typescript
import { db } from '@/lib/db'
import {
  organizations,
  organizationMembers,
  costAllocations,
} from '@/lib/db/schema'
import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

// ---- Types ------------------------------------------------------------------

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer' | 'billing'
export type OrgPlan = 'free' | 'builder' | 'scale' | 'platform' | 'enterprise'

export interface CreateOrgInput {
  name: string
  slug: string
  billingEmail: string
  plan?: OrgPlan
}

export interface InviteMemberInput {
  userId: string
  userType: 'consumer' | 'developer'
  role: OrgRole
  departmentTag?: string
  personalBudgetCents?: number
  invitedBy: string
}

// ---- Permission Matrix ------------------------------------------------------

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  billing: 60,
  member: 40,
  viewer: 20,
}

export type OrgPermission =
  | 'org.manage'
  | 'org.billing'
  | 'org.invite'
  | 'org.view_allocations'
  | 'org.manage_budgets'
  | 'org.view_audit'
  | 'org.manage_whitelabel'
  | 'tools.manage'
  | 'tools.view'
  | 'keys.manage'
  | 'keys.view'

const PERMISSION_MIN_ROLE: Record<OrgPermission, number> = {
  'org.manage': ROLE_HIERARCHY.owner,
  'org.billing': ROLE_HIERARCHY.billing,
  'org.invite': ROLE_HIERARCHY.admin,
  'org.view_allocations': ROLE_HIERARCHY.member,
  'org.manage_budgets': ROLE_HIERARCHY.admin,
  'org.view_audit': ROLE_HIERARCHY.member,
  'org.manage_whitelabel': ROLE_HIERARCHY.admin,
  'tools.manage': ROLE_HIERARCHY.member,
  'tools.view': ROLE_HIERARCHY.viewer,
  'keys.manage': ROLE_HIERARCHY.member,
  'keys.view': ROLE_HIERARCHY.viewer,
}

export function hasPermission(role: OrgRole, permission: OrgPermission): boolean {
  return ROLE_HIERARCHY[role] >= PERMISSION_MIN_ROLE[permission]
}

// ---- Organization CRUD ------------------------------------------------------

export async function createOrganization(input: CreateOrgInput) {
  const [org] = await db
    .insert(organizations)
    .values({
      name: input.name,
      slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      billingEmail: input.billingEmail,
      plan: input.plan ?? 'free',
      settings: {},
    })
    .returning()

  logger.info('org.created', { orgId: org.id, slug: org.slug })
  return org
}

export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  return org ?? null
}

export async function getOrganizationBySlug(slug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1)
  return org ?? null
}

export async function updateOrganization(
  orgId: string,
  updates: Partial<{
    name: string
    billingEmail: string
    plan: OrgPlan
    settings: Record<string, unknown>
    monthlyBudgetCents: number | null
  }>
) {
  const [updated] = await db
    .update(organizations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning()
  return updated
}

// ---- Membership Management --------------------------------------------------

export async function inviteMember(orgId: string, input: InviteMemberInput) {
  const [member] = await db
    .insert(organizationMembers)
    .values({
      orgId,
      userId: input.userId,
      userType: input.userType,
      role: input.role,
      departmentTag: input.departmentTag ?? null,
      personalBudgetCents: input.personalBudgetCents ?? null,
      invitedBy: input.invitedBy,
    })
    .returning()

  logger.info('org.member_invited', {
    orgId,
    userId: input.userId,
    role: input.role,
  })

  return member
}

export async function removeMember(orgId: string, userId: string) {
  await db
    .delete(organizationMembers)
    .where(and(
      eq(organizationMembers.orgId, orgId),
      eq(organizationMembers.userId, userId),
    ))
}

export async function updateMemberRole(orgId: string, userId: string, role: OrgRole) {
  await db
    .update(organizationMembers)
    .set({ role })
    .where(and(
      eq(organizationMembers.orgId, orgId),
      eq(organizationMembers.userId, userId),
    ))
}

export async function getOrgMembers(orgId: string) {
  return db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, orgId))
    .limit(500)
}

export async function getMemberRole(orgId: string, userId: string): Promise<OrgRole | null> {
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.orgId, orgId),
      eq(organizationMembers.userId, userId),
    ))
    .limit(1)
  return (member?.role as OrgRole) ?? null
}

// ---- Cost Allocation --------------------------------------------------------

export async function getCostAllocations(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return db
    .select()
    .from(costAllocations)
    .where(and(
      eq(costAllocations.orgId, orgId),
      gte(costAllocations.periodStart, periodStart),
      lte(costAllocations.periodEnd, periodEnd),
    ))
    .limit(1000)
}

export async function upsertCostAllocation(
  orgId: string,
  departmentTag: string,
  serviceId: string | null,
  periodStart: Date,
  periodEnd: Date,
  costCents: number,
  operationCount: number
) {
  await db
    .insert(costAllocations)
    .values({
      orgId,
      departmentTag,
      serviceId,
      periodStart,
      periodEnd,
      totalCents: costCents,
      operationCount,
    })
    .onConflictDoUpdate({
      target: [costAllocations.orgId, costAllocations.departmentTag, costAllocations.periodStart],
      set: {
        totalCents: sql`${costAllocations.totalCents} + ${costCents}`,
        operationCount: sql`${costAllocations.operationCount} + ${operationCount}`,
      },
    })
}
```

### 5.3 Organization API Routes

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/org/route.ts` (new file) -- POST to create org, GET to list user's orgs.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/org/[id]/route.ts` (new file) -- GET org details, PATCH to update org.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/org/[id]/members/route.ts` (new file) -- GET members, POST to invite.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/org/[id]/members/[userId]/route.ts` (new file) -- PATCH role, DELETE to remove.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/org/[id]/allocations/route.ts` (new file) -- GET cost allocations with `?period=2026-03` query param.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/org/[id]/allocations/export/route.ts` (new file) -- GET CSV/JSON export of allocations.

All routes follow the same pattern: Zod validation on POST/PATCH, rate limiting, role-based access checks via `getMemberRole()` + `hasPermission()`, `maxDuration` on every handler. Example skeleton for each:

```typescript
// Pattern for all org routes:
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getMemberRole, hasPermission } from '@/lib/organizations'
import { logger } from '@/lib/logger'

export const maxDuration = 10

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await checkRateLimit(apiLimiter, `org:${id}:${ip}`)
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 })

  // Auth: extract userId from session/clerk, check role
  // const role = await getMemberRole(id, userId)
  // if (!role || !hasPermission(role, 'org.invite')) return 403

  // Zod validate body, execute, return
}
```

### 5.4 Compliance & Audit Trail Extensions

**File**: `/Users/lex/settlegrid/apps/web/src/lib/compliance.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { auditLogs, complianceExports, consumers, invocations, purchases } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

// ---- Cryptographic Audit Chain ----------------------------------------------

/**
 * Compute the chain hash for an audit log entry.
 * hash = SHA-256(previousHash + JSON(entry))
 * This creates an append-only tamper-evident ledger.
 */
export function computeChainHash(
  previousHash: string,
  entry: { action: string; resourceType: string; resourceId: string | null; timestamp: string }
): string {
  const payload = previousHash + JSON.stringify(entry)
  return crypto.createHash('sha256').update(payload).digest('hex')
}

/**
 * Get the hash of the most recent audit log entry for chaining.
 */
export async function getLatestAuditHash(): Promise<string> {
  const [latest] = await db
    .select({ details: auditLogs.details })
    .from(auditLogs)
    .orderBy(sql`${auditLogs.createdAt} DESC`)
    .limit(1)

  const details = latest?.details as Record<string, unknown> | null
  return (details?.chainHash as string) ?? 'genesis'
}

// ---- GDPR Data Export -------------------------------------------------------

export async function createDataExport(consumerId: string): Promise<string> {
  // Create export record
  const [exportRecord] = await db
    .insert(complianceExports)
    .values({
      requestedBy: consumerId,
      requestType: 'data_export',
      status: 'processing',
    })
    .returning({ id: complianceExports.id })

  // Gather all consumer data
  const consumerData = await db
    .select()
    .from(consumers)
    .where(eq(consumers.id, consumerId))
    .limit(1)

  const invocationData = await db
    .select()
    .from(invocations)
    .where(eq(invocations.consumerId, consumerId))
    .limit(10000)

  const purchaseData = await db
    .select()
    .from(purchases)
    .where(eq(purchases.consumerId, consumerId))
    .limit(10000)

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    consumer: consumerData[0] ?? null,
    invocations: invocationData,
    purchases: purchaseData,
  }

  // In production, upload to S3/Supabase Storage and generate signed URL.
  // For now, store as JSON in the metadata.
  await db
    .update(complianceExports)
    .set({
      status: 'completed',
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: { recordCount: invocationData.length + purchaseData.length },
    })
    .where(eq(complianceExports.id, exportRecord.id))

  logger.info('compliance.data_export_completed', {
    consumerId,
    exportId: exportRecord.id,
    recordCount: invocationData.length + purchaseData.length,
  })

  return exportRecord.id
}

// ---- GDPR Data Deletion (Anonymization) -------------------------------------

export async function processDataDeletion(consumerId: string): Promise<void> {
  const [exportRecord] = await db
    .insert(complianceExports)
    .values({
      requestedBy: consumerId,
      requestType: 'data_deletion',
      status: 'processing',
    })
    .returning({ id: complianceExports.id })

  // Anonymize consumer record (retain financial data for legal compliance)
  await db
    .update(consumers)
    .set({
      email: `deleted_${consumerId.slice(0, 8)}@anonymized.settlegrid.ai`,
      clerkUserId: null,
      passwordHash: null,
      stripeCustomerId: null, // Stripe handles their own GDPR
      defaultPaymentMethodId: null,
    })
    .where(eq(consumers.id, consumerId))

  // Anonymize invocations: keep financial data, remove metadata
  await db
    .update(invocations)
    .set({ metadata: null, sessionId: null, referralCode: null })
    .where(eq(invocations.consumerId, consumerId))

  await db
    .update(complianceExports)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(complianceExports.id, exportRecord.id))

  logger.info('compliance.data_deletion_completed', { consumerId })
}
```

### 5.5 Compliance API Routes

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/compliance/data-export/[consumerId]/route.ts` (new file)
**File**: `/Users/lex/settlegrid/apps/web/src/app/api/compliance/data-deletion/[consumerId]/route.ts` (new file)

Both follow standard route pattern with auth checks, rate limiting, Zod validation.

### 5.6 Usage Aggregation Cron

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/cron/usage-aggregation/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invocations, usageAggregations } from '@/lib/db/schema'
import { sql, gte, lt } from 'drizzle-orm'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cronSecret = getCronSecret()
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Aggregate yesterday's data
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Aggregate by tool (daily)
    const toolAggs = await db
      .select({
        toolId: invocations.toolId,
        totalOps: sql<number>`COUNT(*)`,
        totalRevenue: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)`,
        uniqueConsumers: sql<number>`COUNT(DISTINCT ${invocations.consumerId})`,
        avgLatency: sql<number>`AVG(${invocations.latencyMs})`,
      })
      .from(invocations)
      .where(sql`${invocations.createdAt} >= ${periodStart} AND ${invocations.createdAt} < ${periodEnd}`)
      .groupBy(invocations.toolId)
      .limit(10000)

    for (const agg of toolAggs) {
      await db
        .insert(usageAggregations)
        .values({
          entityId: agg.toolId,
          entityType: 'tool',
          period: 'daily',
          periodStart,
          totalOperations: agg.totalOps,
          totalRevenueCents: agg.totalRevenue,
          totalCostCents: 0, // platform cost tracking
          uniqueConsumers: agg.uniqueConsumers,
          avgLatencyMs: agg.avgLatency ? Math.round(agg.avgLatency) : null,
        })
        .onConflictDoNothing()
    }

    logger.info('cron.usage_aggregation_completed', {
      period: periodStart.toISOString(),
      toolCount: toolAggs.length,
    })

    return NextResponse.json({
      period: periodStart.toISOString(),
      aggregated: toolAggs.length,
    })
  } catch (err) {
    logger.error('cron.usage_aggregation_failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 5.7 White-Label Configuration API

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/org/[id]/whitelabel/route.ts` (new file)

GET and PUT for white-label configuration. Requires `org.manage_whitelabel` permission.

### 5.8 SLA Monitoring

**File**: `/Users/lex/settlegrid/apps/web/src/lib/sla.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { toolHealthChecks } from '@/lib/db/schema'
import { eq, gte, sql } from 'drizzle-orm'

export interface SLAMetrics {
  uptimePct: number
  latencyP50Ms: number
  latencyP95Ms: number
  latencyP99Ms: number
  totalChecks: number
  failedChecks: number
  degradedChecks: number
}

export async function computeSLAMetrics(
  toolId: string,
  since: Date
): Promise<SLAMetrics> {
  const checks = await db
    .select({
      status: toolHealthChecks.status,
      responseTimeMs: toolHealthChecks.responseTimeMs,
    })
    .from(toolHealthChecks)
    .where(sql`${toolHealthChecks.toolId} = ${toolId} AND ${toolHealthChecks.checkedAt} >= ${since}`)
    .limit(50000)

  if (checks.length === 0) {
    return { uptimePct: 100, latencyP50Ms: 0, latencyP95Ms: 0, latencyP99Ms: 0, totalChecks: 0, failedChecks: 0, degradedChecks: 0 }
  }

  const failed = checks.filter(c => c.status === 'down').length
  const degraded = checks.filter(c => c.status === 'degraded').length
  const uptimePct = ((checks.length - failed) / checks.length) * 100

  const latencies = checks
    .map(c => c.responseTimeMs)
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b)

  function percentile(sorted: number[], pct: number): number {
    if (sorted.length === 0) return 0
    const idx = Math.ceil((pct / 100) * sorted.length) - 1
    return sorted[Math.max(0, idx)]
  }

  return {
    uptimePct: Math.round(uptimePct * 100) / 100,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    latencyP99Ms: percentile(latencies, 99),
    totalChecks: checks.length,
    failedChecks: failed,
    degradedChecks: degraded,
  }
}
```

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/tools/[id]/sla/route.ts` (new file)

GET endpoint returning SLA metrics with `?days=30` query parameter.

### 5.9 Enterprise Tests

Target: 60+ test cases covering:
- Organization CRUD and slug validation
- Member invite, role assignment, role hierarchy
- Permission matrix (all 11 permissions x 5 roles)
- Cost allocation upsert and period queries
- Compliance data export and deletion (GDPR)
- Audit chain hash verification
- White-label configuration
- SLA metrics computation (uptime %, latency percentiles)
- Usage aggregation correctness

---

## Phase 6: AP2 Credentials Provider (2 weeks)

**Goal**: Integrate with Google's Agentic Payments Protocol (AP2) as a Credentials Provider, accessing the 180+ partner ecosystem. This positions SettleGrid as the payment rail that AP2-compatible agents use.

### 6.1 AP2 Types and Constants

**File**: `/Users/lex/settlegrid/apps/web/src/lib/ap2/types.ts` (new file)

```typescript
// ---- AP2 Protocol Types (per google-agentic-commerce/ap2 spec) ---------------

export interface AP2AgentCard {
  name: string
  description: string
  url: string
  skills: string[]
  extensions: string[]
  ap2_roles: ('credentials-provider' | 'merchant' | 'agent')[]
}

export interface IntentMandate {
  type: 'ap2.mandates.IntentMandate'
  version: '0.1'
  mandateId: string
  issuedAt: string // ISO 8601
  expiresAt: string
  shoppingIntent: {
    category: string
    maxBudgetCents: number
    currency: string
    description: string
  }
  userSignature: string // ES256K JWT
  agentId: string
  nonce: string
}

export interface CartMandate {
  type: 'ap2.mandates.CartMandate'
  version: '0.1'
  mandateId: string
  issuedAt: string
  expiresAt: string
  merchantId: string
  merchantSignature: string // ES256K JWT
  lineItems: Array<{
    id: string
    description: string
    amountCents: number
    currency: string
    quantity: number
  }>
  totalAmountCents: number
  currency: string
  intentMandateRef: string // reference to the originating IntentMandate
}

export interface PaymentMandate {
  type: 'ap2.mandates.PaymentMandate'
  version: '0.1'
  mandateId: string
  issuedAt: string
  cartMandateRef: string
  paymentMethod: 'settlegrid_balance' | 'stripe_card' | 'usdc'
  paymentCredentialRef: string
  amountCents: number
  currency: string
  agentPresence: {
    agentId: string
    transactionModality: 'autonomous' | 'supervised' | 'manual'
    userVerificationMethod: 'passkey' | 'pin' | 'biometric' | 'none'
  }
  credentialsProviderSignature: string
}

export interface PaymentCredential {
  id: string
  type: 'settlegrid_balance' | 'stripe_card' | 'usdc'
  consumerId: string
  displayName: string
  lastFour?: string
  balanceCents?: number
  expiresAt: string
  tokenRef: string // opaque token for the credential
}

export interface AP2SkillRequest {
  skill: string
  params: Record<string, unknown>
  mandateRef?: string
}

export interface AP2SkillResponse {
  success: boolean
  data?: unknown
  error?: string
}

// ---- Verifiable Digital Credential (VDC) JWT Claims --------------------------

export interface VDCClaims {
  iss: string // issuer (SettleGrid)
  sub: string // subject (consumer ID)
  aud: string // audience (merchant or agent)
  iat: number // issued at (epoch seconds)
  exp: number // expires at
  mandate_type: string
  mandate_id: string
  payment_method: string
  amount_cents: number
  currency: string
}
```

### 6.2 AP2 Agent Card Endpoint

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/a2a/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import type { AP2AgentCard } from '@/lib/ap2/types'

export const maxDuration = 5

const AGENT_CARD: AP2AgentCard = {
  name: 'SettleGrid Settlement',
  description:
    'AI settlement layer -- payment method management and credential issuance for autonomous agent commerce.',
  url: 'https://api.settlegrid.ai/a2a',
  skills: [
    'get_eligible_payment_methods',
    'provision_credentials',
    'process_payment',
    'verify_intent_mandate',
    'verify_cart_mandate',
  ],
  extensions: ['https://github.com/google-agentic-commerce/ap2/tree/v0.1'],
  ap2_roles: ['credentials-provider'],
}

export async function GET() {
  return NextResponse.json(AGENT_CARD, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
```

### 6.3 AP2 Credentials Provider Implementation

**File**: `/Users/lex/settlegrid/apps/web/src/lib/ap2/credentials-provider.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { consumers, consumerToolBalances } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import type {
  PaymentCredential,
  IntentMandate,
  CartMandate,
  PaymentMandate,
  VDCClaims,
} from './types'

// ---- JWT Signing (ES256K for AP2 compatibility) ------------------------------

// In production, use a proper ES256K key pair stored in env.
// For MVP, use HMAC-SHA256 as a JWT signing stand-in.
function signJwt(payload: VDCClaims, secretKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyJwt(token: string, secretKey: string): VDCClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url')

  if (parts[2] !== expectedSig) return null

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as VDCClaims
  } catch {
    return null
  }
}

// ---- Skill: get_eligible_payment_methods ------------------------------------

export async function getEligiblePaymentMethods(
  consumerId: string
): Promise<PaymentCredential[]> {
  const [consumer] = await db
    .select()
    .from(consumers)
    .where(eq(consumers.id, consumerId))
    .limit(1)

  if (!consumer) return []

  const methods: PaymentCredential[] = []

  // 1. SettleGrid balance (aggregate across all tools)
  const balances = await db
    .select({
      total: sql<number>`COALESCE(SUM(${consumerToolBalances.balanceCents}), 0)`,
    })
    .from(consumerToolBalances)
    .where(eq(consumerToolBalances.consumerId, consumerId))

  const totalBalance = balances[0]?.total ?? 0
  if (totalBalance > 0) {
    methods.push({
      id: `sg_balance_${consumerId.slice(0, 8)}`,
      type: 'settlegrid_balance',
      consumerId,
      displayName: 'SettleGrid Balance',
      balanceCents: totalBalance,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      tokenRef: crypto.randomUUID(),
    })
  }

  // 2. Stripe card on file (if stripeCustomerId exists)
  if (consumer.stripeCustomerId) {
    methods.push({
      id: `sg_card_${consumerId.slice(0, 8)}`,
      type: 'stripe_card',
      consumerId,
      displayName: 'Card on File',
      lastFour: '****', // In production, fetch from Stripe
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      tokenRef: crypto.randomUUID(),
    })
  }

  return methods
}

// ---- Skill: provision_credentials -------------------------------------------

export async function provisionCredentials(
  consumerId: string,
  paymentMethodType: 'settlegrid_balance' | 'stripe_card' | 'usdc',
  amountCents: number,
  currency: string,
  merchantId: string
): Promise<{ credentialRef: string; vdc: string }> {
  const secretKey = process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'

  const claims: VDCClaims = {
    iss: 'settlegrid.ai',
    sub: consumerId,
    aud: merchantId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    mandate_type: 'payment_credential',
    mandate_id: crypto.randomUUID(),
    payment_method: paymentMethodType,
    amount_cents: amountCents,
    currency,
  }

  const vdc = signJwt(claims, secretKey)
  const credentialRef = crypto.randomUUID()

  logger.info('ap2.credentials_provisioned', {
    consumerId,
    paymentMethodType,
    amountCents,
    credentialRef,
  })

  return { credentialRef, vdc }
}

// ---- Skill: verify_intent_mandate -------------------------------------------

export function verifyIntentMandate(mandate: IntentMandate): {
  valid: boolean
  reason?: string
} {
  // Check expiry
  if (new Date(mandate.expiresAt) < new Date()) {
    return { valid: false, reason: 'Intent mandate expired' }
  }

  // Check version
  if (mandate.version !== '0.1') {
    return { valid: false, reason: `Unsupported mandate version: ${mandate.version}` }
  }

  // In production, verify userSignature with the user's public key via ES256K.
  // For MVP, accept if structure is valid.
  if (!mandate.userSignature || !mandate.agentId || !mandate.nonce) {
    return { valid: false, reason: 'Missing required fields' }
  }

  return { valid: true }
}

// ---- Skill: verify_cart_mandate ---------------------------------------------

export function verifyCartMandate(mandate: CartMandate): {
  valid: boolean
  reason?: string
} {
  if (new Date(mandate.expiresAt) < new Date()) {
    return { valid: false, reason: 'Cart mandate expired' }
  }

  if (mandate.version !== '0.1') {
    return { valid: false, reason: `Unsupported mandate version: ${mandate.version}` }
  }

  // Verify line item totals
  const computedTotal = mandate.lineItems.reduce(
    (sum, item) => sum + item.amountCents * item.quantity,
    0
  )
  if (computedTotal !== mandate.totalAmountCents) {
    return { valid: false, reason: 'Line item total mismatch' }
  }

  // In production, verify merchantSignature.
  if (!mandate.merchantSignature || !mandate.merchantId) {
    return { valid: false, reason: 'Missing required fields' }
  }

  return { valid: true }
}

// ---- Skill: process_payment -------------------------------------------------

export async function processPayment(
  consumerId: string,
  mandate: PaymentMandate
): Promise<{
  success: boolean
  transactionId: string
  error?: string
}> {
  const transactionId = crypto.randomUUID()

  // Verify the payment mandate structure
  if (!mandate.cartMandateRef || !mandate.paymentCredentialRef) {
    return { success: false, transactionId, error: 'Invalid payment mandate' }
  }

  switch (mandate.paymentMethod) {
    case 'settlegrid_balance': {
      // Deduct from consumer's SettleGrid balance
      // This integrates with the existing metering system
      // Find the largest balance across tools and deduct from it
      // (In production, this would use a dedicated AP2 balance pool)
      logger.info('ap2.payment_processed', {
        consumerId,
        method: 'settlegrid_balance',
        amountCents: mandate.amountCents,
        transactionId,
      })
      return { success: true, transactionId }
    }

    case 'stripe_card': {
      // Create a Stripe PaymentIntent using the consumer's card on file
      // (In production, use Stripe SDK)
      logger.info('ap2.payment_processed', {
        consumerId,
        method: 'stripe_card',
        amountCents: mandate.amountCents,
        transactionId,
      })
      return { success: true, transactionId }
    }

    default:
      return { success: false, transactionId, error: `Unsupported payment method: ${mandate.paymentMethod}` }
  }
}
```

### 6.4 AP2 A2A Message Handler

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/a2a/skills/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getEligiblePaymentMethods,
  provisionCredentials,
  verifyIntentMandate,
  verifyCartMandate,
  processPayment,
} from '@/lib/ap2/credentials-provider'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 15

const skillRequestSchema = z.object({
  skill: z.enum([
    'get_eligible_payment_methods',
    'provision_credentials',
    'process_payment',
    'verify_intent_mandate',
    'verify_cart_mandate',
  ]),
  params: z.record(z.unknown()),
  mandateRef: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await checkRateLimit(apiLimiter, `a2a:skills:${ip}`)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = skillRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { skill, params } = parsed.data

    switch (skill) {
      case 'get_eligible_payment_methods': {
        const consumerId = z.string().uuid().parse(params.consumerId)
        const methods = await getEligiblePaymentMethods(consumerId)
        return NextResponse.json({ success: true, data: { methods } })
      }

      case 'provision_credentials': {
        const consumerId = z.string().uuid().parse(params.consumerId)
        const paymentMethodType = z.enum(['settlegrid_balance', 'stripe_card', 'usdc']).parse(params.paymentMethodType)
        const amountCents = z.number().int().min(1).parse(params.amountCents)
        const currency = z.string().length(3).parse(params.currency ?? 'USD')
        const merchantId = z.string().parse(params.merchantId)

        const result = await provisionCredentials(consumerId, paymentMethodType, amountCents, currency, merchantId)
        return NextResponse.json({ success: true, data: result })
      }

      case 'verify_intent_mandate': {
        const mandate = params.mandate as import('@/lib/ap2/types').IntentMandate
        const result = verifyIntentMandate(mandate)
        return NextResponse.json({ success: true, data: result })
      }

      case 'verify_cart_mandate': {
        const mandate = params.mandate as import('@/lib/ap2/types').CartMandate
        const result = verifyCartMandate(mandate)
        return NextResponse.json({ success: true, data: result })
      }

      case 'process_payment': {
        const consumerId = z.string().uuid().parse(params.consumerId)
        const mandate = params.mandate as import('@/lib/ap2/types').PaymentMandate
        const result = await processPayment(consumerId, mandate)
        return NextResponse.json({ success: true, data: result })
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown skill' }, { status: 400 })
    }
  } catch (err) {
    logger.error('a2a.skill_execution_failed', {}, err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

### 6.5 AP2 Environment Variables

Add to `/Users/lex/settlegrid/apps/web/src/lib/env.ts`:

```typescript
export function getAp2SigningSecret(): string {
  return process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'
}

export function getAp2VerificationKey(): string | undefined {
  return process.env.AP2_VERIFICATION_KEY
}
```

### 6.6 AP2 Tests

Target: 30+ test cases covering:
- Agent Card endpoint returns correct structure
- get_eligible_payment_methods returns balance and card when available
- provision_credentials generates valid VDC JWT
- verify_intent_mandate rejects expired, invalid version, missing fields
- verify_cart_mandate rejects total mismatch, expired, missing fields
- process_payment via settlegrid_balance and stripe_card
- JWT signing and verification round-trip

---

## Phase 7: Visa TAP Integration (2 weeks)

**Goal**: Integrate with Visa's Trusted Agent Protocol for card-network-level settlement. This adds Visa as a payment rail alongside Stripe and crypto.

### 7.1 Visa Agent Token Schema

**File**: `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts`

Add after AP2-related tables:

```typescript
// ---- Visa Agent Tokens -------------------------------------------------------

export const visaAgentTokens = pgTable(
  'visa_agent_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull(), // the AI agent that holds this token
    tokenRef: text('token_ref').notNull().unique(), // Visa token reference
    lastFour: text('last_four'), // last 4 digits of underlying card
    cardBrand: text('card_brand'), // 'visa' | 'mastercard'
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('active'),
      // 'active' | 'suspended' | 'revoked' | 'expired'
    merchantScope: text('merchant_scope'), // null = unrestricted, or merchant ID
    maxTransactionCents: integer('max_transaction_cents'), // per-transaction limit
    dailyLimitCents: integer('daily_limit_cents'),
    dailySpentCents: integer('daily_spent_cents').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    metadata: jsonb('metadata'), // { visaPanId, enrollmentId, etc. }
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('visa_tokens_consumer_id_idx').on(table.consumerId),
    index('visa_tokens_agent_id_idx').on(table.agentId),
    index('visa_tokens_status_idx').on(table.status),
    uniqueIndex('visa_tokens_token_ref_idx').on(table.tokenRef),
  ]
)

// ---- Visa Transactions -------------------------------------------------------

export const visaTransactions = pgTable(
  'visa_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenId: uuid('token_id')
      .notNull()
      .references(() => visaAgentTokens.id, { onDelete: 'cascade' }),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    merchantId: text('merchant_id'),
    merchantName: text('merchant_name'),
    status: text('status').notNull().default('pending'),
      // 'pending' | 'authorized' | 'captured' | 'declined' | 'reversed' | 'disputed'
    visaAuthCode: text('visa_auth_code'),
    visaNetworkRef: text('visa_network_ref'),
    agentAttestation: jsonb('agent_attestation'),
      // { agentId, confidence, decisionContext, userVerification }
    disputeStatus: text('dispute_status'), // null | 'opened' | 'under_review' | 'resolved'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('visa_tx_token_id_idx').on(table.tokenId),
    index('visa_tx_consumer_id_idx').on(table.consumerId),
    index('visa_tx_status_idx').on(table.status),
    index('visa_tx_created_at_idx').on(table.createdAt),
  ]
)
```

### 7.2 Visa TAP Client Library

**File**: `/Users/lex/settlegrid/apps/web/src/lib/visa/client.ts` (new file)

```typescript
import { logger } from '@/lib/logger'

// ---- Visa TAP API Configuration -----------------------------------------------

const VISA_BASE_URL = process.env.VISA_API_URL ?? 'https://sandbox.api.visa.com'
const VISA_API_KEY = process.env.VISA_API_KEY
const VISA_SHARED_SECRET = process.env.VISA_SHARED_SECRET

interface VisaTokenProvisionRequest {
  primaryAccountNumber: string
  expirationDate: string // MM/YYYY
  cardholderName: string
  agentId: string
  merchantScope?: string
  maxTransactionCents?: number
}

interface VisaTokenProvisionResponse {
  tokenReferenceId: string
  lastFourDigits: string
  tokenStatus: string
  expirationDate: string
}

interface VisaPaymentInstructionRequest {
  tokenReferenceId: string
  amountCents: number
  currency: string
  merchantId: string
  agentAttestation: {
    agentId: string
    confidence: number
    decisionContext: string
    userVerificationMethod: string
  }
}

interface VisaPaymentInstructionResponse {
  authorizationCode: string
  networkReferenceId: string
  responseCode: string
  responseMessage: string
}

// ---- Visa API Client ---------------------------------------------------------

async function visaApiCall<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!VISA_API_KEY || !VISA_SHARED_SECRET) {
    throw new Error('Visa API credentials not configured')
  }

  const url = `${VISA_BASE_URL}${path}`
  const timestamp = new Date().toISOString()

  // Visa uses HTTP Basic Auth with API Key + Shared Secret
  const authHeader = Buffer.from(`${VISA_API_KEY}:${VISA_SHARED_SECRET}`).toString('base64')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authHeader}`,
      'X-Request-ID': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    logger.error('visa.api_error', { path, status: response.status, body: errorBody })
    throw new Error(`Visa API error: ${response.status}`)
  }

  return (await response.json()) as T
}

// ---- Token Lifecycle ---------------------------------------------------------

export async function provisionAgentToken(
  request: VisaTokenProvisionRequest
): Promise<VisaTokenProvisionResponse> {
  return visaApiCall<VisaTokenProvisionResponse>(
    '/intelligent-commerce/v1/tokens/provision',
    {
      ...request,
      channelType: 'AI_AGENT',
    }
  )
}

export async function submitPaymentInstruction(
  request: VisaPaymentInstructionRequest
): Promise<VisaPaymentInstructionResponse> {
  return visaApiCall<VisaPaymentInstructionResponse>(
    '/intelligent-commerce/v1/payments/authorize',
    {
      tokenReferenceId: request.tokenReferenceId,
      transactionAmount: {
        amount: request.amountCents,
        currency: request.currency,
      },
      merchantId: request.merchantId,
      agentAttestation: request.agentAttestation,
    }
  )
}

export async function revokeToken(tokenReferenceId: string): Promise<void> {
  await visaApiCall('/intelligent-commerce/v1/tokens/revoke', {
    tokenReferenceId,
  })
}
```

### 7.3 Visa Token Management Service

**File**: `/Users/lex/settlegrid/apps/web/src/lib/visa/tokens.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { visaAgentTokens, visaTransactions } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { provisionAgentToken, submitPaymentInstruction, revokeToken } from './client'
import { logger } from '@/lib/logger'

export async function createAgentToken(
  consumerId: string,
  agentId: string,
  options: {
    merchantScope?: string
    maxTransactionCents?: number
    dailyLimitCents?: number
    expiresInDays?: number
  } = {}
) {
  // In production, the consumer's card details would come from Stripe or a PCI-compliant vault.
  // For the sandbox, we use test card data.
  const visaResponse = await provisionAgentToken({
    primaryAccountNumber: '4111111111111111', // sandbox test card
    expirationDate: '12/2028',
    cardholderName: 'AI Agent',
    agentId,
    merchantScope: options.merchantScope,
    maxTransactionCents: options.maxTransactionCents,
  })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays ?? 30))

  const [token] = await db
    .insert(visaAgentTokens)
    .values({
      consumerId,
      agentId,
      tokenRef: visaResponse.tokenReferenceId,
      lastFour: visaResponse.lastFourDigits,
      cardBrand: 'visa',
      expiresAt,
      merchantScope: options.merchantScope ?? null,
      maxTransactionCents: options.maxTransactionCents ?? null,
      dailyLimitCents: options.dailyLimitCents ?? null,
    })
    .returning()

  logger.info('visa.token_provisioned', {
    consumerId,
    agentId,
    tokenId: token.id,
  })

  return token
}

export async function processVisaPayment(
  tokenId: string,
  amountCents: number,
  merchantId: string,
  agentAttestation: {
    agentId: string
    confidence: number
    decisionContext: string
    userVerificationMethod: string
  }
) {
  // Get token
  const [token] = await db
    .select()
    .from(visaAgentTokens)
    .where(eq(visaAgentTokens.id, tokenId))
    .limit(1)

  if (!token || token.status !== 'active') {
    throw new Error('Token not found or not active')
  }

  // Check per-transaction limit
  if (token.maxTransactionCents && amountCents > token.maxTransactionCents) {
    throw new Error(`Amount ${amountCents} exceeds per-transaction limit ${token.maxTransactionCents}`)
  }

  // Check daily limit
  if (token.dailyLimitCents && (token.dailySpentCents + amountCents) > token.dailyLimitCents) {
    throw new Error(`Amount would exceed daily limit`)
  }

  // Submit to Visa
  const visaResponse = await submitPaymentInstruction({
    tokenReferenceId: token.tokenRef,
    amountCents,
    currency: 'USD',
    merchantId,
    agentAttestation,
  })

  // Record transaction
  const [tx] = await db
    .insert(visaTransactions)
    .values({
      tokenId: token.id,
      consumerId: token.consumerId,
      amountCents,
      merchantId,
      status: visaResponse.responseCode === '00' ? 'authorized' : 'declined',
      visaAuthCode: visaResponse.authorizationCode,
      visaNetworkRef: visaResponse.networkReferenceId,
      agentAttestation,
    })
    .returning()

  // Update daily spend
  if (visaResponse.responseCode === '00') {
    await db
      .update(visaAgentTokens)
      .set({
        dailySpentCents: sql`${visaAgentTokens.dailySpentCents} + ${amountCents}`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(visaAgentTokens.id, tokenId))
  }

  return tx
}

export async function revokeAgentToken(tokenId: string) {
  const [token] = await db
    .select({ tokenRef: visaAgentTokens.tokenRef })
    .from(visaAgentTokens)
    .where(eq(visaAgentTokens.id, tokenId))
    .limit(1)

  if (!token) throw new Error('Token not found')

  await revokeToken(token.tokenRef)

  await db
    .update(visaAgentTokens)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(visaAgentTokens.id, tokenId))
}
```

### 7.4 Visa API Routes

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/visa/tokens/route.ts` -- POST to provision, GET to list consumer's tokens.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/visa/tokens/[id]/route.ts` -- GET token details, DELETE to revoke.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/visa/payments/route.ts` -- POST to process a payment.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/visa/transactions/route.ts` -- GET transaction history.

All routes: Zod validation, rate limiting, `maxDuration`, auth checks.

### 7.5 Visa Environment Variables

Add to `/Users/lex/settlegrid/apps/web/src/lib/env.ts`:

```typescript
export function getVisaApiUrl(): string {
  return process.env.VISA_API_URL ?? 'https://sandbox.api.visa.com'
}

export function getVisaApiKey(): string | undefined {
  return process.env.VISA_API_KEY
}

export function getVisaSharedSecret(): string | undefined {
  return process.env.VISA_SHARED_SECRET
}
```

### 7.6 Visa MCP Bridge

**File**: `/Users/lex/settlegrid/apps/web/src/lib/visa/mcp-bridge.ts` (new file)

Bridges Visa's MCP Server capabilities into SettleGrid's settlement engine. When an MCP tool invocation requires payment via Visa, the bridge:

1. Looks up the consumer's Visa agent token
2. Authorizes the payment via Visa TAP
3. Records the transaction in SettleGrid's ledger
4. Meters the invocation in SettleGrid's existing metering system

```typescript
import { processVisaPayment } from './tokens'
import { recordInvocationAsync } from '@/lib/metering'
import { logger } from '@/lib/logger'

export async function bridgeVisaPayment(params: {
  tokenId: string
  toolId: string
  consumerId: string
  developerId: string
  method: string
  costCents: number
  agentId: string
  revenueSharePct: number
}) {
  // 1. Process via Visa
  const tx = await processVisaPayment(
    params.tokenId,
    params.costCents,
    'settlegrid_platform', // SettleGrid is the merchant of record
    {
      agentId: params.agentId,
      confidence: 1.0,
      decisionContext: `MCP tool invocation: ${params.method}`,
      userVerificationMethod: 'none',
    }
  )

  // 2. Record in SettleGrid metering (for analytics and developer payouts)
  recordInvocationAsync({
    toolId: params.toolId,
    consumerId: params.consumerId,
    keyId: 'visa-bridge', // special key ID for Visa-bridged invocations
    method: params.method,
    costCents: params.costCents,
    latencyMs: null,
    developerId: params.developerId,
    revenueSharePct: params.revenueSharePct,
  })

  logger.info('visa.mcp_bridge_completed', {
    transactionId: tx.id,
    toolId: params.toolId,
    costCents: params.costCents,
  })

  return tx
}
```

### 7.7 Visa Daily Limit Reset Cron

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/cron/visa-daily-reset/route.ts` (new file)

Resets `dailySpentCents` to 0 on all active Visa agent tokens. Run at midnight UTC.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { visaAgentTokens } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export const maxDuration = 15

export async function GET(req: NextRequest) {
  const cronSecret = getCronSecret()
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await db
      .update(visaAgentTokens)
      .set({ dailySpentCents: 0, updatedAt: new Date() })
      .where(eq(visaAgentTokens.status, 'active'))

    logger.info('cron.visa_daily_reset')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('cron.visa_daily_reset_failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 7.8 Visa Tests

Target: 25+ test cases covering:
- Token provisioning (success, error handling)
- Payment processing (authorized, declined, over-limit)
- Daily limit enforcement and reset
- Token revocation
- MCP bridge integration
- Transaction recording

---

## Phase 8: Advanced Features & Market Dominance (4 weeks)

**Goal**: Build the moat features that make SettleGrid indispensable: predictive cost management, outcome-based settlement, real-time streaming, multi-currency, and the developer ecosystem.

### 8.1 Outcome-Based Settlement

**File**: `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts`

```typescript
// ---- Outcome Verifications ---------------------------------------------------

export const outcomeVerifications = pgTable(
  'outcome_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invocationId: uuid('invocation_id')
      .notNull()
      .references(() => invocations.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    outcomeType: text('outcome_type').notNull(), // 'boolean' | 'score' | 'custom'
    successCriteria: jsonb('success_criteria').notNull(),
      // { minScore?: number; maxLatencyMs?: number; requiredFields?: string[];
      //   customValidator?: string }
    fullPriceCents: integer('full_price_cents').notNull(),
    failurePriceCents: integer('failure_price_cents').notNull().default(0),
    actualOutcome: jsonb('actual_outcome'), // the raw result from the tool
    outcomeScore: integer('outcome_score'), // 0-100 for score-based
    passed: boolean('passed'),
    settledPriceCents: integer('settled_price_cents'), // what was actually charged
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    disputeStatus: text('dispute_status'), // null | 'opened' | 'under_review' | 'resolved_for_consumer' | 'resolved_for_provider'
    disputeReason: text('dispute_reason'),
    disputeResolvedAt: timestamp('dispute_resolved_at', { withTimezone: true }),
    disputeDeadline: timestamp('dispute_deadline', { withTimezone: true }), // 24h from verification
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('outcome_verifications_invocation_id_idx').on(table.invocationId),
    index('outcome_verifications_tool_id_idx').on(table.toolId),
    index('outcome_verifications_consumer_id_idx').on(table.consumerId),
    index('outcome_verifications_dispute_status_idx').on(table.disputeStatus),
  ]
)
```

**File**: `/Users/lex/settlegrid/apps/web/src/lib/outcomes.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { outcomeVerifications, consumerToolBalances, developers, tools } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface OutcomeCriteria {
  outcomeType: 'boolean' | 'score' | 'custom'
  minScore?: number
  maxLatencyMs?: number
  requiredFields?: string[]
}

export interface VerifyOutcomeInput {
  invocationId: string
  toolId: string
  consumerId: string
  criteria: OutcomeCriteria
  fullPriceCents: number
  failurePriceCents: number
  actualOutcome: unknown
  latencyMs: number
}

export function evaluateOutcome(
  criteria: OutcomeCriteria,
  outcome: unknown,
  latencyMs: number
): { passed: boolean; score: number; reason?: string } {
  // Latency check (applies to all types)
  if (criteria.maxLatencyMs && latencyMs > criteria.maxLatencyMs) {
    return { passed: false, score: 0, reason: `Latency ${latencyMs}ms exceeds max ${criteria.maxLatencyMs}ms` }
  }

  switch (criteria.outcomeType) {
    case 'boolean': {
      const passed = outcome !== null && outcome !== undefined && outcome !== false
      return { passed, score: passed ? 100 : 0 }
    }

    case 'score': {
      const score = typeof outcome === 'number' ? outcome : 0
      const minScore = criteria.minScore ?? 0.5
      const normalizedScore = Math.round(score * 100)
      return {
        passed: score >= minScore,
        score: normalizedScore,
        reason: score < minScore ? `Score ${score} below minimum ${minScore}` : undefined,
      }
    }

    case 'custom': {
      // For custom outcomes, check required fields exist in the result
      if (criteria.requiredFields && typeof outcome === 'object' && outcome !== null) {
        const obj = outcome as Record<string, unknown>
        const missing = criteria.requiredFields.filter(f => !(f in obj))
        if (missing.length > 0) {
          return { passed: false, score: 0, reason: `Missing required fields: ${missing.join(', ')}` }
        }
      }
      return { passed: true, score: 100 }
    }

    default:
      return { passed: true, score: 100 }
  }
}

export async function verifyAndSettle(input: VerifyOutcomeInput): Promise<{
  passed: boolean
  settledPriceCents: number
  verificationId: string
}> {
  const evaluation = evaluateOutcome(
    input.criteria,
    input.actualOutcome,
    input.latencyMs
  )

  const settledPriceCents = evaluation.passed
    ? input.fullPriceCents
    : input.failurePriceCents

  const [verification] = await db
    .insert(outcomeVerifications)
    .values({
      invocationId: input.invocationId,
      toolId: input.toolId,
      consumerId: input.consumerId,
      outcomeType: input.criteria.outcomeType,
      successCriteria: input.criteria,
      fullPriceCents: input.fullPriceCents,
      failurePriceCents: input.failurePriceCents,
      actualOutcome: input.actualOutcome,
      outcomeScore: evaluation.score,
      passed: evaluation.passed,
      settledPriceCents,
      verifiedAt: new Date(),
      disputeDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    })
    .returning({ id: outcomeVerifications.id })

  // If outcome failed, refund the difference to the consumer
  if (!evaluation.passed && input.fullPriceCents > settledPriceCents) {
    const refundCents = input.fullPriceCents - settledPriceCents
    await db
      .update(consumerToolBalances)
      .set({
        balanceCents: sql`${consumerToolBalances.balanceCents} + ${refundCents}`,
      })
      .where(and(
        eq(consumerToolBalances.consumerId, input.consumerId),
        eq(consumerToolBalances.toolId, input.toolId),
      ))

    logger.info('outcome.partial_refund', {
      consumerId: input.consumerId,
      toolId: input.toolId,
      refundCents,
    })
  }

  return {
    passed: evaluation.passed,
    settledPriceCents,
    verificationId: verification.id,
  }
}

// ---- Dispute Handling -------------------------------------------------------

export async function openDispute(
  verificationId: string,
  consumerId: string,
  reason: string
): Promise<void> {
  await db
    .update(outcomeVerifications)
    .set({
      disputeStatus: 'opened',
      disputeReason: reason,
    })
    .where(and(
      eq(outcomeVerifications.id, verificationId),
      eq(outcomeVerifications.consumerId, consumerId),
    ))

  logger.info('outcome.dispute_opened', { verificationId, consumerId, reason })
}

export async function resolveDispute(
  verificationId: string,
  resolution: 'resolved_for_consumer' | 'resolved_for_provider',
  adjustedPriceCents?: number
): Promise<void> {
  const [verification] = await db
    .select()
    .from(outcomeVerifications)
    .where(eq(outcomeVerifications.id, verificationId))
    .limit(1)

  if (!verification) throw new Error('Verification not found')

  await db
    .update(outcomeVerifications)
    .set({
      disputeStatus: resolution,
      disputeResolvedAt: new Date(),
      settledPriceCents: adjustedPriceCents ?? verification.settledPriceCents,
    })
    .where(eq(outcomeVerifications.id, verificationId))

  // If resolved for consumer, refund the remaining amount
  if (resolution === 'resolved_for_consumer' && verification.settledPriceCents) {
    await db
      .update(consumerToolBalances)
      .set({
        balanceCents: sql`${consumerToolBalances.balanceCents} + ${verification.settledPriceCents}`,
      })
      .where(and(
        eq(consumerToolBalances.consumerId, verification.consumerId),
        eq(consumerToolBalances.toolId, verification.toolId),
      ))
  }

  logger.info('outcome.dispute_resolved', { verificationId, resolution })
}
```

### 8.2 Predictive Cost Management

**File**: `/Users/lex/settlegrid/apps/web/src/lib/cost-prediction.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { usageAggregations } from '@/lib/db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

interface CostForecast {
  nextDayCents: number
  nextWeekCents: number
  nextMonthCents: number
  confidence: number // 0-1
  trend: 'increasing' | 'stable' | 'decreasing'
  anomalyDetected: boolean
  anomalyDetails?: string
  optimizationSuggestions: string[]
}

/**
 * Simple exponential moving average (EMA) based cost forecasting.
 * Uses daily aggregations from the last 30 days.
 * For production, replace with a proper ML model on Modal.
 */
export async function forecastCosts(
  entityId: string,
  entityType: 'consumer' | 'developer' | 'org' | 'tool'
): Promise<CostForecast> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const dailyData = await db
    .select({
      periodStart: usageAggregations.periodStart,
      totalCosts: usageAggregations.totalCostCents,
      totalRevenue: usageAggregations.totalRevenueCents,
      totalOps: usageAggregations.totalOperations,
    })
    .from(usageAggregations)
    .where(and(
      eq(usageAggregations.entityId, entityId),
      eq(usageAggregations.entityType, entityType),
      eq(usageAggregations.period, 'daily'),
      gte(usageAggregations.periodStart, thirtyDaysAgo),
    ))
    .limit(30)

  if (dailyData.length < 3) {
    return {
      nextDayCents: 0,
      nextWeekCents: 0,
      nextMonthCents: 0,
      confidence: 0,
      trend: 'stable',
      anomalyDetected: false,
      optimizationSuggestions: [],
    }
  }

  const costs = dailyData.map(d => d.totalRevenue)
  const n = costs.length

  // EMA with alpha = 0.3
  const alpha = 0.3
  let ema = costs[0]
  for (let i = 1; i < n; i++) {
    ema = alpha * costs[i] + (1 - alpha) * ema
  }

  // Trend detection: compare last 7 days avg vs prior 7 days avg
  const recent7 = costs.slice(-7)
  const prior7 = costs.slice(-14, -7)
  const recentAvg = recent7.reduce((a, b) => a + b, 0) / recent7.length
  const priorAvg = prior7.length > 0
    ? prior7.reduce((a, b) => a + b, 0) / prior7.length
    : recentAvg

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
  const changeRate = priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : 0
  if (changeRate > 0.1) trend = 'increasing'
  else if (changeRate < -0.1) trend = 'decreasing'

  // Anomaly detection: >2 standard deviations from rolling average
  const mean = costs.reduce((a, b) => a + b, 0) / n
  const variance = costs.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  const lastCost = costs[n - 1]
  const anomalyDetected = Math.abs(lastCost - mean) > 2 * stdDev
  const anomalyDetails = anomalyDetected
    ? `Last day spend (${lastCost} cents) is ${((lastCost - mean) / stdDev).toFixed(1)} standard deviations from the 30-day mean (${Math.round(mean)} cents)`
    : undefined

  // Confidence based on data volume
  const confidence = Math.min(1, n / 14) // Full confidence at 14+ days

  // Optimization suggestions
  const suggestions: string[] = []
  if (trend === 'increasing' && changeRate > 0.2) {
    suggestions.push('Spending is increasing rapidly. Consider setting budget alerts.')
  }
  if (anomalyDetected && lastCost > mean) {
    suggestions.push('Anomalous spending spike detected. Review recent operations.')
  }

  return {
    nextDayCents: Math.round(ema),
    nextWeekCents: Math.round(ema * 7),
    nextMonthCents: Math.round(ema * 30),
    confidence: Math.round(confidence * 100) / 100,
    trend,
    anomalyDetected,
    anomalyDetails,
    optimizationSuggestions: suggestions,
  }
}
```

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/consumer/cost-forecast/route.ts` (new file)

GET endpoint returning cost forecast for the authenticated consumer.

### 8.3 Multi-Currency Support

**File**: `/Users/lex/settlegrid/apps/web/src/lib/currency.ts` (new file)

```typescript
import { getRedis, tryRedis } from './redis'
import { logger } from './logger'

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'USDC'

const FALLBACK_RATES: Record<string, number> = {
  'EUR/USD': 1.08,
  'GBP/USD': 1.27,
  'JPY/USD': 0.0067,
  'USDC/USD': 1.0,
  'USD/EUR': 0.926,
  'USD/GBP': 0.787,
  'USD/JPY': 149.5,
  'USD/USDC': 1.0,
}

const FX_CACHE_KEY = 'fx:rates'
const FX_CACHE_TTL = 3600 // 1 hour

/**
 * Fetch exchange rates from Open Exchange Rates API.
 * Falls back to hardcoded rates if API is unavailable.
 */
async function fetchRates(): Promise<Record<string, number>> {
  const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY
  if (!apiKey) {
    logger.warn('currency.no_api_key', { message: 'Using fallback exchange rates' })
    return FALLBACK_RATES
  }

  try {
    const res = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&symbols=EUR,GBP,JPY`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) throw new Error(`OXR API returned ${res.status}`)

    const data = (await res.json()) as { rates: Record<string, number> }
    const rates: Record<string, number> = {}

    for (const [currency, rate] of Object.entries(data.rates)) {
      rates[`USD/${currency}`] = rate
      rates[`${currency}/USD`] = 1 / rate
    }
    rates['USDC/USD'] = 1.0
    rates['USD/USDC'] = 1.0

    return rates
  } catch (err) {
    logger.error('currency.fetch_rates_failed', {}, err)
    return FALLBACK_RATES
  }
}

/**
 * Get exchange rate between two currencies (with Redis caching).
 */
export async function getExchangeRate(
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<number> {
  if (from === to) return 1.0

  const redis = getRedis()
  const cacheKey = `${FX_CACHE_KEY}:${from}/${to}`

  // Try cache first
  const cached = await tryRedis(() => redis.get<number>(cacheKey))
  if (cached !== null) return cached

  // Fetch fresh rates
  const rates = await fetchRates()
  const key = `${from}/${to}`
  const rate = rates[key] ?? FALLBACK_RATES[key] ?? 1.0

  // Cache for 1 hour
  await tryRedis(() => redis.set(cacheKey, rate, { ex: FX_CACHE_TTL }))

  return rate
}

/**
 * Convert an amount from one currency to another.
 * Returns the converted amount in the target currency's smallest unit (cents/pence/etc.)
 */
export async function convertCurrency(
  amountCents: number,
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<number> {
  if (from === to) return amountCents
  const rate = await getExchangeRate(from, to)
  return Math.round(amountCents * rate)
}

/**
 * Format an amount in cents for display.
 */
export function formatCurrency(amountCents: number, currency: SupportedCurrency): string {
  const amount = amountCents / 100
  switch (currency) {
    case 'USD':
    case 'USDC':
      return `$${amount.toFixed(2)}`
    case 'EUR':
      return `\u20AC${amount.toFixed(2)}`
    case 'GBP':
      return `\u00A3${amount.toFixed(2)}`
    case 'JPY':
      return `\u00A5${Math.round(amount)}`
    default:
      return `${amount.toFixed(2)} ${currency}`
  }
}
```

### 8.4 Real-Time Cost Streaming

For real-time cost streaming, we use Server-Sent Events (SSE) since Vercel supports streaming responses but not WebSocket in serverless. The SDK connects via EventSource.

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/stream/[sessionId]/route.ts` (new file)

```typescript
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { workflowSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRedis, tryRedis } from '@/lib/redis'

export const maxDuration = 300 // 5 minute max for streaming
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  // Verify session exists
  const [session] = await db
    .select({ id: workflowSessions.id, status: workflowSessions.status })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  const redis = getRedis()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      const budget = await tryRedis(() => redis.get<number>(`session:budget:${sessionId}`))
      const spent = await tryRedis(() => redis.get<number>(`session:spent:${sessionId}`))
      const reserved = await tryRedis(() => redis.get<number>(`session:reserved:${sessionId}`))

      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({
          type: 'session.state',
          budgetCents: budget ?? 0,
          spentCents: spent ?? 0,
          reservedCents: reserved ?? 0,
          remainingCents: (budget ?? 0) - (spent ?? 0) - (reserved ?? 0),
          status: session.status,
          timestamp: new Date().toISOString(),
        })}\n\n`
      ))

      // Poll for updates every 1 second (in production, use Redis pub/sub)
      let lastSpent = spent ?? 0
      let running = true
      const intervalId = setInterval(async () => {
        if (!running) return

        try {
          const currentSpent = await tryRedis(() => redis.get<number>(`session:spent:${sessionId}`))
          const currentReserved = await tryRedis(() => redis.get<number>(`session:reserved:${sessionId}`))

          if (currentSpent !== null && currentSpent !== lastSpent) {
            lastSpent = currentSpent
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({
                type: 'balance.updated',
                spentCents: currentSpent,
                reservedCents: currentReserved ?? 0,
                remainingCents: (budget ?? 0) - currentSpent - (currentReserved ?? 0),
                timestamp: new Date().toISOString(),
              })}\n\n`
            ))
          }

          // Check budget warning (80% threshold)
          if (budget && currentSpent && currentSpent / budget > 0.8) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({
                type: 'budget.warning',
                percentUsed: Math.round((currentSpent / budget) * 100),
                remainingCents: budget - currentSpent - (currentReserved ?? 0),
                timestamp: new Date().toISOString(),
              })}\n\n`
            ))
          }

          // Send heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // Stream error, close
          running = false
          clearInterval(intervalId)
          controller.close()
        }
      }, 1000)

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        running = false
        clearInterval(intervalId)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

**SDK SSE client** (add to `/Users/lex/settlegrid/packages/mcp/src/stream.ts`):

```typescript
export interface StreamEvent {
  type: 'session.state' | 'balance.updated' | 'budget.warning' | 'budget.exceeded'
  spentCents?: number
  remainingCents?: number
  percentUsed?: number
  timestamp: string
  [key: string]: unknown
}

export function createStreamClient(
  apiUrl: string,
  sessionId: string,
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Error) => void
): { close: () => void } {
  const url = `${apiUrl}/api/stream/${sessionId}`
  const eventSource = new EventSource(url)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as StreamEvent
      onEvent(data)
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Parse error'))
    }
  }

  eventSource.onerror = () => {
    onError?.(new Error('Stream connection error'))
  }

  return {
    close: () => eventSource.close(),
  }
}
```

### 8.5 SDK Ecosystem: Python SDK Specification

**File**: `/Users/lex/settlegrid/packages/python-sdk/settlegrid/__init__.py` (specification for future implementation)

```python
# @settlegrid/python-sdk — specification
#
# Usage:
#   from settlegrid import SettleGrid
#
#   sg = SettleGrid(
#       tool_slug="my-tool",
#       pricing={"default_cost_cents": 1, "methods": {"analyze": {"cost_cents": 5}}}
#   )
#
#   @sg.wrap(method="analyze")
#   def analyze(data: dict) -> dict:
#       return {"result": "analyzed"}
#
#   # Workflow sessions
#   async with sg.session(budget_cents=10000, expires_in="1h") as session:
#       result = await session.call("tool-a", method="process", args=data)
#       result2 = await session.call("tool-b", method="summarize", args=result)
#       # Auto-finalizes on context exit
#
#   # Streaming
#   for event in sg.stream(session_id):
#       print(f"Spent: {event.spent_cents}")
```

### 8.6 OpenAPI 3.1 Specification

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/openapi.json/route.ts` (new file)

Serves a comprehensive OpenAPI 3.1 spec describing all SettleGrid API endpoints:

```typescript
import { NextResponse } from 'next/server'

export const maxDuration = 5

export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'SettleGrid API',
      version: '1.0.0',
      description: 'The Settlement Layer for the AI Economy',
      contact: { email: 'api@settlegrid.ai', url: 'https://settlegrid.ai' },
    },
    servers: [
      { url: 'https://settlegrid.ai', description: 'Production' },
      { url: 'http://localhost:3005', description: 'Development' },
    ],
    paths: {
      '/api/sdk/validate-key': {
        post: {
          summary: 'Validate an API key',
          tags: ['SDK'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['apiKey', 'toolSlug'],
                  properties: {
                    apiKey: { type: 'string' },
                    toolSlug: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Key validation result' },
            '401': { description: 'Invalid API key' },
          },
        },
      },
      '/api/sdk/meter': {
        post: {
          summary: 'Meter a tool invocation',
          tags: ['SDK'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['toolSlug', 'consumerId', 'toolId', 'keyId', 'method', 'costCents'],
                  properties: {
                    toolSlug: { type: 'string' },
                    consumerId: { type: 'string', format: 'uuid' },
                    toolId: { type: 'string', format: 'uuid' },
                    keyId: { type: 'string', format: 'uuid' },
                    method: { type: 'string' },
                    costCents: { type: 'integer', minimum: 0 },
                    latencyMs: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Metering result' },
            '402': { description: 'Insufficient credits' },
          },
        },
      },
      '/api/sessions': {
        post: {
          summary: 'Create a workflow session',
          tags: ['Sessions'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['consumerId', 'budgetCents', 'expiresIn', 'settlementMode'],
                  properties: {
                    consumerId: { type: 'string', format: 'uuid' },
                    budgetCents: { type: 'integer', minimum: 1 },
                    expiresIn: { type: 'string', pattern: '^\\d+(m|h|d)$' },
                    settlementMode: { type: 'string', enum: ['immediate', 'deferred', 'atomic'] },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Session created' },
          },
        },
      },
      // ... additional paths follow the same pattern for all endpoints
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
```

### 8.7 Referral Network Extensions

**File**: `/Users/lex/settlegrid/apps/web/src/lib/referral-network.ts` (new file)

```typescript
import { db } from '@/lib/db'
import { referrals, developers, invocations } from '@/lib/db/schema'
import { eq, sql, gte } from 'drizzle-orm'

export interface ReferralNetworkNode {
  developerId: string
  name: string | null
  referralCode: string
  totalEarnedCents: number
  referredTools: number
  downstreamReferrals: number
}

/**
 * Build a referral network graph for a developer.
 * Shows who they've referred and their earnings chain.
 */
export async function getReferralNetwork(
  developerId: string
): Promise<{
  nodes: ReferralNetworkNode[]
  totalNetworkEarnings: number
  topReferrer: ReferralNetworkNode | null
}> {
  // Get all referrals by this developer
  const myReferrals = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referrerId, developerId))
    .limit(1000)

  const nodes: ReferralNetworkNode[] = []
  let totalNetworkEarnings = 0

  for (const ref of myReferrals) {
    const [dev] = await db
      .select({ name: developers.name })
      .from(developers)
      .where(eq(developers.id, ref.referrerId))
      .limit(1)

    nodes.push({
      developerId: ref.referrerId,
      name: dev?.name ?? null,
      referralCode: ref.referralCode,
      totalEarnedCents: ref.totalEarnedCents,
      referredTools: 1,
      downstreamReferrals: 0,
    })

    totalNetworkEarnings += ref.totalEarnedCents
  }

  const topReferrer = nodes.length > 0
    ? nodes.reduce((max, n) => n.totalEarnedCents > max.totalEarnedCents ? n : max)
    : null

  return { nodes, totalNetworkEarnings, topReferrer }
}
```

### 8.8 Developer Portal Pages

Create the following Next.js pages under `/Users/lex/settlegrid/apps/web/src/app/(portal)/`:

**File**: `/Users/lex/settlegrid/apps/web/src/app/(portal)/docs/page.tsx` -- Interactive API docs (renders OpenAPI spec)
**File**: `/Users/lex/settlegrid/apps/web/src/app/(portal)/docs/getting-started/page.tsx` -- "Monetize your MCP server in 5 minutes"
**File**: `/Users/lex/settlegrid/apps/web/src/app/(portal)/pricing-calculator/page.tsx` -- Interactive pricing calculator
**File**: `/Users/lex/settlegrid/apps/web/src/app/(portal)/changelog/page.tsx` -- Public changelog
**File**: `/Users/lex/settlegrid/apps/web/src/app/(portal)/status/page.tsx` -- Status page showing uptime and latency

---

## 5. Pricing Strategy

### 5.1 Pricing Configuration

**File**: `/Users/lex/settlegrid/apps/web/src/lib/pricing.ts` (new file)

```typescript
export interface PricingTier {
  id: string
  name: string
  priceCents: number // monthly price in cents
  includedTxPerMonth: number
  overageCentsPerTx: number // in millicents (1000 = $0.001)
  features: string[]
  limits: {
    maxTools: number
    maxApiKeys: number
    maxWebhooks: number
    maxSessionBudgetCents: number
    maxOrgMembers: number
    supportLevel: 'community' | 'email' | 'priority' | 'dedicated'
    slaUptimePct: number
    retentionDays: number
  }
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    includedTxPerMonth: 10_000,
    overageCentsPerTx: 0, // hard capped
    features: ['10K transactions/mo', 'Basic dashboard', 'Community support'],
    limits: {
      maxTools: 3,
      maxApiKeys: 5,
      maxWebhooks: 1,
      maxSessionBudgetCents: 10_000, // $100
      maxOrgMembers: 1,
      supportLevel: 'community',
      slaUptimePct: 99.0,
      retentionDays: 30,
    },
  },
  {
    id: 'builder',
    name: 'Builder',
    priceCents: 2_900,
    includedTxPerMonth: 50_000,
    overageCentsPerTx: 100, // $0.001
    features: [
      '50K transactions/mo',
      'Workflow sessions',
      'Budget federation',
      'Webhook retry',
      'Email support',
    ],
    limits: {
      maxTools: 10,
      maxApiKeys: 25,
      maxWebhooks: 5,
      maxSessionBudgetCents: 100_000, // $1K
      maxOrgMembers: 3,
      supportLevel: 'email',
      slaUptimePct: 99.5,
      retentionDays: 90,
    },
  },
  {
    id: 'scale',
    name: 'Scale',
    priceCents: 9_900,
    includedTxPerMonth: 500_000,
    overageCentsPerTx: 50, // $0.0005
    features: [
      '500K transactions/mo',
      'Outcome-based settlement',
      'Cost forecasting',
      'Multi-currency',
      'Priority support',
    ],
    limits: {
      maxTools: 50,
      maxApiKeys: 100,
      maxWebhooks: 20,
      maxSessionBudgetCents: 1_000_000, // $10K
      maxOrgMembers: 10,
      supportLevel: 'priority',
      slaUptimePct: 99.9,
      retentionDays: 365,
    },
  },
  {
    id: 'platform',
    name: 'Platform',
    priceCents: 29_900,
    includedTxPerMonth: 5_000_000,
    overageCentsPerTx: 20, // $0.0002
    features: [
      '5M transactions/mo',
      'White-label',
      'SSO/RBAC',
      'AP2 + Visa TAP',
      'Cost allocation',
      'SLA dashboard',
      'Dedicated support',
    ],
    limits: {
      maxTools: 500,
      maxApiKeys: 1000,
      maxWebhooks: 100,
      maxSessionBudgetCents: 10_000_000, // $100K
      maxOrgMembers: 50,
      supportLevel: 'dedicated',
      slaUptimePct: 99.95,
      retentionDays: 730, // 2 years
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceCents: -1, // custom
    includedTxPerMonth: -1, // custom
    overageCentsPerTx: -1, // custom
    features: [
      'Unlimited transactions',
      'Custom SLA',
      'Dedicated infrastructure',
      'Custom integrations',
      'On-call support',
    ],
    limits: {
      maxTools: 999999,
      maxApiKeys: 999999,
      maxWebhooks: 999999,
      maxSessionBudgetCents: 999_999_999,
      maxOrgMembers: 999999,
      supportLevel: 'dedicated',
      slaUptimePct: 99.99,
      retentionDays: 2555, // 7 years
    },
  },
]

export function getTier(tierId: string): PricingTier | undefined {
  return PRICING_TIERS.find(t => t.id === tierId)
}

export function getEffectiveTakeRate(tier: PricingTier, avgTxCents: number): number {
  if (tier.priceCents <= 0 || avgTxCents <= 0) return 0
  const gmv = tier.includedTxPerMonth * avgTxCents / 100
  return gmv > 0 ? (tier.priceCents / 100) / gmv : 0
}
```

### 5.2 Stripe Integration for Tier Billing

Extend existing Stripe integration at `/Users/lex/settlegrid/apps/web/src/app/api/billing/checkout/route.ts` to support the new tier structure. Create Stripe Price objects for each tier during setup.

### 5.3 Revenue Projections Model

**File**: `/Users/lex/settlegrid/apps/web/src/lib/revenue-model.ts` (new file)

```typescript
export interface RevenueProjection {
  month: number
  freeUsers: number
  builderUsers: number
  scaleUsers: number
  platformUsers: number
  enterpriseUsers: number
  mrrCents: number
  overageRevenueCents: number
  totalMrrCents: number
  gmvCents: number
}

/**
 * Project revenue based on growth assumptions.
 * Conservative model for bootstrapper context.
 */
export function projectRevenue(months: number): RevenueProjection[] {
  const projections: RevenueProjection[] = []

  for (let m = 1; m <= months; m++) {
    // Growth curves (conservative)
    const freeUsers = Math.round(50 * Math.pow(1.3, m))
    const conversionRate = 0.15 // 15% free -> paid
    const paidUsers = Math.round(freeUsers * conversionRate)

    // Distribution across tiers
    const builderUsers = Math.round(paidUsers * 0.6)
    const scaleUsers = Math.round(paidUsers * 0.25)
    const platformUsers = Math.round(paidUsers * 0.1)
    const enterpriseUsers = Math.round(paidUsers * 0.05)

    const mrrCents =
      builderUsers * 2_900 +
      scaleUsers * 9_900 +
      platformUsers * 29_900 +
      enterpriseUsers * 99_900

    // Assume 20% overage on average
    const overageRevenueCents = Math.round(mrrCents * 0.2)

    // GMV = avg $0.02/tx * included tx
    const gmvCents =
      freeUsers * 10_000 * 2 +
      builderUsers * 50_000 * 2 +
      scaleUsers * 500_000 * 2 +
      platformUsers * 5_000_000 * 2

    projections.push({
      month: m,
      freeUsers,
      builderUsers,
      scaleUsers,
      platformUsers,
      enterpriseUsers,
      mrrCents,
      overageRevenueCents,
      totalMrrCents: mrrCents + overageRevenueCents,
      gmvCents,
    })
  }

  return projections
}
```

---

## 6. Go-to-Market Playbook

### 6.1 Siphon Integration for Distribution

SettleGrid's GTM is powered by Siphon (the distribution automation platform at `/Users/lex/fieldbrief/apps/siphon/`). Configure Siphon to:

1. **Prospect enrichment**: Target MCP server creators on GitHub (search for `@modelcontextprotocol/sdk` in package.json files)
2. **ICP scoring**: Score prospects on: GitHub stars, npm downloads, whether they have any monetization, tech stack compatibility
3. **Outreach sequences**: 3-touch email sequence via Instantly.ai:
   - Email 1: "I noticed your MCP server [name] -- here's how to earn revenue from it in 5 minutes"
   - Email 2: Case study / social proof
   - Email 3: Direct offer (first 100 MCP servers get 6 months free on Builder tier)

### 6.2 Content Marketing Calendar

Create the following content pieces (manage via Siphon's content marketing subsystem):

| Week | Title | Channel |
|------|-------|---------|
| 1 | "How I Monetized My MCP Server in 5 Minutes" | Dev.to, HN |
| 2 | "The Economics of AI Tool APIs: Per-Call vs Subscription" | Blog |
| 3 | "Why Stripe Can't Solve AI Billing (Yet)" | Twitter thread |
| 4 | "Building the Visa of AI: Settlement for Multi-Agent Workflows" | Blog |
| 5 | "AP2 + SettleGrid: How Google's Payment Protocol Works with MCP" | Blog |
| 6 | "Atomic Settlement for AI Workflows: A Technical Deep Dive" | Blog |

---

## 7. Regulatory Compliance Roadmap

### 7.1 Implementation Files

**File**: `/Users/lex/settlegrid/apps/web/src/lib/compliance/mtl-analysis.ts` (new file)

Document why SettleGrid does not require a Money Transmitter License:
1. SettleGrid never custodies consumer funds (Stripe holds all money)
2. SettleGrid is a technology platform, not a payment processor
3. All fund movements happen via Stripe Connect (which IS licensed)
4. SettleGrid's role is instruction-giving, not fund-holding

**File**: `/Users/lex/settlegrid/apps/web/src/lib/compliance/sanctions.ts` (new file)

```typescript
/**
 * OFAC/sanctions screening is handled by Stripe at the payment level.
 * This module provides additional screening for high-risk operations.
 */
export async function screenForSanctions(
  entityName: string,
  countryCode: string
): Promise<{ cleared: boolean; flags: string[] }> {
  // High-risk countries list (OFAC comprehensive sanctions)
  const SANCTIONED_COUNTRIES = [
    'CU', 'IR', 'KP', 'SY', 'RU', // fully sanctioned
  ]

  const flags: string[] = []

  if (SANCTIONED_COUNTRIES.includes(countryCode.toUpperCase())) {
    flags.push(`Country ${countryCode} is under comprehensive sanctions`)
  }

  return { cleared: flags.length === 0, flags }
}
```

---

## 8. Risk Assessment

### 8.1 Technical Risk Mitigations in Code

**Redis SPOF mitigation**: Already implemented in `/Users/lex/settlegrid/apps/web/src/lib/redis.ts` via `tryRedis()` wrapper and DB fallback in `/Users/lex/settlegrid/apps/web/src/lib/metering.ts`.

**Stripe dependency mitigation**: Phase 7 Visa TAP adds an alternative payment rail. Future phases add crypto disbursement.

**Protocol fragmentation mitigation**: Phase 6 AP2 + Phase 7 Visa TAP + existing MCP support = Switzerland position across all three major protocols.

---

## 9. Success Metrics Implementation

**File**: `/Users/lex/settlegrid/apps/web/src/lib/metrics.ts` (new file)

```typescript
import { db } from '@/lib/db'
import {
  invocations,
  developers,
  consumers,
  tools,
  purchases,
  workflowSessions,
} from '@/lib/db/schema'
import { sql, gte, and, eq } from 'drizzle-orm'

export interface PlatformMetrics {
  // North Star
  gmvCents: number // total settlement volume
  gmvGrowthPct: number // month-over-month

  // Leading Indicators
  totalDevelopers: number
  totalConsumers: number
  activeTools: number
  dailyOperations: number
  activeSessionCount: number

  // Business Metrics
  mrrCents: number
  netRevenueRetentionPct: number
  developerChurnRatePct: number
  avgRevenuePerDeveloperCents: number
  grossMarginPct: number

  // Computed at
  computedAt: string
}

export async function computePlatformMetrics(): Promise<PlatformMetrics> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // GMV (last 30 days)
  const [currentGmv] = await db
    .select({ total: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)` })
    .from(invocations)
    .where(gte(invocations.createdAt, thirtyDaysAgo))

  // GMV (prior 30 days for growth calc)
  const [priorGmv] = await db
    .select({ total: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)` })
    .from(invocations)
    .where(and(
      gte(invocations.createdAt, sixtyDaysAgo),
      sql`${invocations.createdAt} < ${thirtyDaysAgo}`,
    ))

  // Counts
  const [devCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(developers)
  const [consumerCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(consumers)
  const [toolCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tools)
    .where(eq(tools.status, 'active'))

  // Daily operations
  const [dailyOps] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(invocations)
    .where(gte(invocations.createdAt, oneDayAgo))

  // Active sessions
  const [sessionCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(workflowSessions)
    .where(eq(workflowSessions.status, 'active'))

  // MRR (sum of subscription revenue + platform fees)
  const [mrrData] = await db
    .select({ total: sql<number>`COALESCE(SUM(${purchases.amountCents}), 0)` })
    .from(purchases)
    .where(and(
      gte(purchases.createdAt, thirtyDaysAgo),
      eq(purchases.status, 'completed'),
    ))

  const gmvCents = currentGmv?.total ?? 0
  const priorGmvCents = priorGmv?.total ?? 0
  const gmvGrowthPct = priorGmvCents > 0
    ? ((gmvCents - priorGmvCents) / priorGmvCents) * 100
    : 0

  return {
    gmvCents,
    gmvGrowthPct: Math.round(gmvGrowthPct * 10) / 10,
    totalDevelopers: devCount?.count ?? 0,
    totalConsumers: consumerCount?.count ?? 0,
    activeTools: toolCount?.count ?? 0,
    dailyOperations: dailyOps?.count ?? 0,
    activeSessionCount: sessionCount?.count ?? 0,
    mrrCents: mrrData?.total ?? 0,
    netRevenueRetentionPct: 0, // requires cohort analysis
    developerChurnRatePct: 0, // requires cohort analysis
    avgRevenuePerDeveloperCents: devCount?.count
      ? Math.round(gmvCents / devCount.count)
      : 0,
    grossMarginPct: 92, // estimated (infrastructure ~8% of revenue)
    computedAt: now.toISOString(),
  }
}
```

**File**: `/Users/lex/settlegrid/apps/web/src/app/api/dashboard/metrics/route.ts` (new file)

GET endpoint returning platform metrics. Requires admin authentication.

---

## 10. Complete File Inventory

### New Database Tables (Phases 4-8)
| Table | Phase | Purpose |
|-------|-------|---------|
| `workflow_sessions` | 4 | Multi-hop workflow session tracking |
| `settlement_batches` | 4 | Atomic multi-party settlement batches |
| `organizations` | 5 | Multi-tenant org model |
| `organization_members` | 5 | Org membership and roles |
| `cost_allocations` | 5 | Department-level cost tracking |
| `whitelabel_configs` | 5 | White-label branding |
| `compliance_exports` | 5 | GDPR data exports/deletions |
| `usage_aggregations` | 5 | Pre-computed analytics |
| `visa_agent_tokens` | 7 | Visa TAP token management |
| `visa_transactions` | 7 | Visa payment history |
| `outcome_verifications` | 8 | Outcome-based settlement verification |

### New Library Files
| File Path | Phase | Purpose |
|-----------|-------|---------|
| `src/lib/types/sessions.ts` | 4 | Session type definitions |
| `src/lib/sessions.ts` | 4 | Session lifecycle engine |
| `src/lib/organizations.ts` | 5 | Org management + RBAC |
| `src/lib/compliance.ts` | 5 | GDPR export/deletion, audit chain |
| `src/lib/sla.ts` | 5 | SLA metric computation |
| `src/lib/ap2/types.ts` | 6 | AP2 protocol types |
| `src/lib/ap2/credentials-provider.ts` | 6 | AP2 Credentials Provider skills |
| `src/lib/visa/client.ts` | 7 | Visa TAP API client |
| `src/lib/visa/tokens.ts` | 7 | Visa token management |
| `src/lib/visa/mcp-bridge.ts` | 7 | Visa-to-MCP settlement bridge |
| `src/lib/outcomes.ts` | 8 | Outcome-based settlement |
| `src/lib/cost-prediction.ts` | 8 | EMA-based cost forecasting |
| `src/lib/currency.ts` | 8 | Multi-currency + FX |
| `src/lib/referral-network.ts` | 8 | Referral graph analysis |
| `src/lib/pricing.ts` | 8 | Tier configuration |
| `src/lib/revenue-model.ts` | 8 | Revenue projections |
| `src/lib/metrics.ts` | 8 | Platform metrics computation |
| `src/lib/compliance/mtl-analysis.ts` | 8 | MTL exemption documentation |
| `src/lib/compliance/sanctions.ts` | 8 | OFAC screening |
| `packages/mcp/src/sessions.ts` | 4 | SDK session client |
| `packages/mcp/src/stream.ts` | 8 | SDK SSE streaming client |

### New API Routes
| Route | Method | Phase | Purpose |
|-------|--------|-------|---------|
| `/api/sessions` | POST | 4 | Create workflow session |
| `/api/sessions/[id]` | GET | 4 | Get session status |
| `/api/sessions/[id]/hop` | POST | 4 | Record a hop |
| `/api/sessions/[id]/finalize` | POST | 4 | Finalize + settle |
| `/api/sessions/[id]/delegate` | POST | 4 | Delegate sub-budget |
| `/api/cron/session-expiry` | GET | 4 | Expire stale sessions |
| `/api/org` | POST/GET | 5 | Create/list orgs |
| `/api/org/[id]` | GET/PATCH | 5 | Org details/update |
| `/api/org/[id]/members` | GET/POST | 5 | Member management |
| `/api/org/[id]/members/[userId]` | PATCH/DELETE | 5 | Role/remove member |
| `/api/org/[id]/allocations` | GET | 5 | Cost allocations |
| `/api/org/[id]/allocations/export` | GET | 5 | CSV/JSON export |
| `/api/org/[id]/whitelabel` | GET/PUT | 5 | White-label config |
| `/api/compliance/data-export/[id]` | GET | 5 | GDPR data export |
| `/api/compliance/data-deletion/[id]` | POST | 5 | GDPR deletion |
| `/api/cron/usage-aggregation` | GET | 5 | Daily aggregation |
| `/api/tools/[id]/sla` | GET | 5 | SLA metrics |
| `/api/a2a` | GET | 6 | AP2 Agent Card |
| `/api/a2a/skills` | POST | 6 | AP2 skill execution |
| `/api/visa/tokens` | POST/GET | 7 | Token provisioning |
| `/api/visa/tokens/[id]` | GET/DELETE | 7 | Token details/revoke |
| `/api/visa/payments` | POST | 7 | Process Visa payment |
| `/api/visa/transactions` | GET | 7 | Transaction history |
| `/api/cron/visa-daily-reset` | GET | 7 | Reset daily limits |
| `/api/stream/[sessionId]` | GET | 8 | SSE cost streaming |
| `/api/consumer/cost-forecast` | GET | 8 | Cost predictions |
| `/api/openapi.json` | GET | 8 | OpenAPI spec |
| `/api/dashboard/metrics` | GET | 8 | Platform metrics |

### New Environment Variables
| Variable | Phase | Purpose |
|----------|-------|---------|
| `AP2_SIGNING_SECRET` | 6 | AP2 VDC JWT signing |
| `AP2_VERIFICATION_KEY` | 6 | AP2 mandate verification |
| `VISA_API_URL` | 7 | Visa sandbox/prod URL |
| `VISA_API_KEY` | 7 | Visa API key |
| `VISA_SHARED_SECRET` | 7 | Visa shared secret |
| `OPEN_EXCHANGE_RATES_API_KEY` | 8 | FX rates API |

### Test Targets
| Phase | Test File | Target Count |
|-------|-----------|-------------|
| 4 | `src/lib/__tests__/sessions.test.ts` | 40+ |
| 5 | `src/lib/__tests__/organizations.test.ts` | 30+ |
| 5 | `src/lib/__tests__/compliance.test.ts` | 20+ |
| 5 | `src/lib/__tests__/sla.test.ts` | 10+ |
| 6 | `src/lib/ap2/__tests__/credentials-provider.test.ts` | 30+ |
| 7 | `src/lib/visa/__tests__/tokens.test.ts` | 25+ |
| 8 | `src/lib/__tests__/outcomes.test.ts` | 25+ |
| 8 | `src/lib/__tests__/cost-prediction.test.ts` | 15+ |
| 8 | `src/lib/__tests__/currency.test.ts` | 15+ |
| **Total** | | **210+** |

---

## 11. Implementation Sequence

Execute phases in this exact order. Each phase builds on the prior.

```
Week 1-2:   Phase 4 — Workflow Sessions & Multi-Hop Settlement
Week 3-5:   Phase 5 — Enterprise Features (org, compliance, analytics)
Week 6-7:   Phase 6 — AP2 Credentials Provider
Week 8-9:   Phase 7 — Visa TAP Integration
Week 10-13: Phase 8 — Advanced Features & Market Dominance
Week 14:    Full integration test suite + load testing
```

After each phase, run:
```bash
cd /Users/lex/settlegrid && npx tsc --noEmit
cd /Users/lex/settlegrid && npm test
cd /Users/lex/settlegrid && npx eslint apps/web/src/ packages/mcp/src/ --max-warnings 0
```

All three commands must produce zero errors before moving to the next phase.

---

*End of SettleGrid Strategic Blueprint -- Part 2*
