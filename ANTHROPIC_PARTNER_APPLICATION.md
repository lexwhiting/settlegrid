# Anthropic Claude Partner Network — SettleGrid Application

**Draft — Review before submitting**
**Date**: March 2026

---

## Company Information

- **Company**: Alerterra, LLC
- **Product**: SettleGrid
- **Website**: https://settlegrid.ai
- **Founded**: 2026
- **Team size**: 1 (founder)
- **Location**: Wilmington, DE
- **Contact**: Lex Whiting — lexwhiting@gmail.com

---

## Executive Summary

SettleGrid is the settlement layer for the AI economy — the only purpose-built monetization infrastructure for MCP tool servers. We enable any MCP developer to go from free to paid in one line of code:

```typescript
settlegrid.wrap(handler, { costCents: 5 })
```

MCP is the fastest-growing AI integration protocol, but it has zero native economic capability. Developers build incredible MCP tools and have no standard way to charge for them. SettleGrid fills this gap with real-time metering, pre-funded credit balances, automated Stripe payouts, and protocol-agnostic settlement.

We are applying to the Claude Partner Network because we believe MCP monetization is critical infrastructure for a healthy MCP ecosystem — and we want to build it in partnership with Anthropic, not in isolation.

---

## The Problem We Solve

MCP defines how AI models connect to external tools. It does not define how tool providers get paid. This is the single largest gap in the MCP ecosystem today:

- **Less than 5% of MCP servers are monetized** despite 85% month-over-month download growth
- Developers report they "cannot earn from their work, so they only put so much effort into it"
- Fewer than 50 MCP servers (out of tens of thousands) are built to production quality
- No standard exists for communicating pricing, checking credits, or metering usage within MCP

Without a monetization layer, the MCP ecosystem will be dominated by free hobby projects rather than production-grade commercial tools. SettleGrid provides the economic infrastructure that incentivizes developers to build and maintain high-quality MCP services.

---

## What We Built

SettleGrid is production-ready infrastructure, not a prototype:

**Core Settlement Engine**
- Real-time Redis metering (sub-50ms on every API call)
- Pre-funded credit balances with auto-refill via Stripe
- Per-method pricing (different costs for different tool functions)
- Budget enforcement with 402 responses when limits are exceeded
- Multi-hop atomic settlement across agent workflows
- Double-entry ledger with optimistic locking

**MCP-Native SDK (@settlegrid/mcp)**
- `settlegrid.init()` + `settlegrid.wrap()` — one function call adds billing to any MCP tool
- API key extraction from MCP `_meta` fields and HTTP headers
- LRU-cached key validation (5-minute TTL, 1000 entries)
- Fire-and-forget async metering (does not block tool responses)
- Published on npm, MIT licensed

**MCP Payment Extension (SEP Draft)**
- Proposed `experimental.payment` capability for the MCP specification
- Defines how servers declare pricing in `tools/list` responses
- Defines standard error codes (-32001 through -32005) for payment failures
- Defines pricing metadata schema for MCP Server Cards (.well-known)
- SettleGrid SDK serves as the reference implementation

**Protocol-Agnostic Design**
- MCP (native SDK integration)
- x402 (Coinbase) — full facilitator with EIP-3009 verification and on-chain settlement on Base
- AP2 (Google) — Credentials Provider role in the 180+ partner ecosystem
- Visa TAP — adapter ready, pending sandbox approval
- REST — middleware for any Express/Next.js API

**Enterprise Features**
- Organizations with RBAC (owner/admin/member/viewer)
- Agent identity (KYA) compatible with AgentFacts and Skyfire JWT
- Outcome-based billing with dispute resolution
- Multi-currency settlement (USD, EUR, GBP, JPY, USDC)
- GDPR compliance (data export/deletion workflows)
- SOC 2 readiness

**Production Quality**
- 2,700+ automated tests across 110+ test files
- 90+ API routes, all with rate limiting, Zod validation, and CORS
- 30 database tables with CHECK constraints and 64 indexes
- 45 transactional email templates with dark mode and CAN-SPAM compliance
- Zero TypeScript errors, zero ESLint errors
- Deployed on Vercel with Supabase Auth (Google + GitHub OAuth)

---

## How We Complement the Claude Ecosystem

**For MCP Tool Developers:**
- Turn any MCP server into a paid service in 5 minutes
- Automated Stripe Connect payouts (85% revenue share)
- Analytics dashboard (invocations, revenue, health, reputation)
- No need to build billing infrastructure from scratch

**For MCP Tool Consumers:**
- Pre-purchased credits (no per-transaction payment friction)
- Budget controls and spending limits
- API key management with IP allowlisting
- Auto-refill so tools never stop working

**For Anthropic / Claude:**
- Incentivizes developers to build production-quality MCP tools
- Creates a sustainable economic model for the MCP ecosystem
- Provides the missing "App Store economics" layer for Claude's tool ecosystem
- Standards-based approach (MCP Payment SEP) benefits the entire community

---

## What We Are Asking For

1. **Partner Network membership** — to be listed as an official MCP ecosystem partner for monetization infrastructure

2. **Claude Marketplace integration** — when Anthropic launches marketplace features, SettleGrid should be the settlement layer that handles payments between enterprises and tool providers

3. **MCP Payment SEP co-sponsorship** — we have drafted a Standards Enhancement Proposal for an `experimental.payment` capability in MCP. We would welcome Anthropic's review and co-sponsorship through the SEP process with the Enterprise Working Group.

4. **Early access to MCP Registry** — as the Registry develops, we want to ensure pricing metadata fields are included from the start, so developers can declare their tool pricing in a standard format

---

## What We Offer in Return

1. **Open-source SDK** — @settlegrid/mcp is MIT licensed and will remain so
2. **MCP Payment SEP** — we will author and maintain the specification
3. **Reference MCP servers** — we will build and publish 3-5 example paid MCP servers demonstrating the integration pattern
4. **Developer education** — blog posts, documentation, and tutorials on MCP monetization
5. **Zero cost to Anthropic** — we are self-funded and do not require investment or credits

---

## Competitive Landscape

| Player | Focus | Why SettleGrid is Different |
|--------|-------|---------------------------|
| Stripe + Metronome | Generic AI billing | No MCP SDK, async metering (can't enforce real-time balance), no agent identity |
| Nevermined | x402 facilitator | 13 GitHub stars, proprietary lock-in, Base-only, 1-6.5% fees |
| Paid.ai | Cost attribution | No settlement layer, no MCP integration, no agent-to-agent payments |
| Apify/MCPize | MCP hosting + monetization | 15% rev share vs our flat $29/mo, no multi-protocol support |

SettleGrid is the only product that combines MCP-native SDK integration, synchronous real-time metering, multi-protocol settlement, and agent identity in a single platform.

---

## Traction (as of application date)

- Product: fully deployed at settlegrid.ai
- SDK: published as @settlegrid/mcp on npm
- x402: live on-chain settlement verified on Base (mainnet + testnet)
- Auth: Supabase with Google + GitHub OAuth
- Stripe Connect: fully configured for developer payouts
- Tests: 2,700+ passing with zero failures
- Email system: 45 templates covering full user lifecycle

---

## Technical Architecture

```
AI Agent / MCP Client
       │
       ▼
MCP Server (wrapped with @settlegrid/mcp)
       │
       ▼
SettleGrid Settlement Engine
  ├── Identity (KYA agent verification)
  ├── Metering (Redis DECRBY, sub-50ms)
  ├── Budget Enforcement (per-session, per-agent)
  ├── Fraud Detection (3-signal scoring)
  └── Ledger (double-entry, optimistic locking)
       │
       ├── Stripe Connect (fiat payouts)
       └── x402 / Base (crypto settlement)
```

---

## Contact

Lex Whiting
Founder, Alerterra LLC
lexwhiting@gmail.com
https://settlegrid.ai
