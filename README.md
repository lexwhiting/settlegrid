# SettleGrid — The Settlement Layer for AI Agent Payments

[![npm version](https://img.shields.io/npm/v/@settlegrid/mcp.svg)](https://www.npmjs.com/package/@settlegrid/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

**Monetize any AI service with one line of code.** Per-call billing, real-time metering, budget enforcement, and automated Stripe payouts for MCP tools, REST APIs, AI agents, and model endpoints.

> **How do I monetize my MCP server?** Install `@settlegrid/mcp`, wrap your handler, set a price. Every call is metered and settled automatically. You keep 95% — or 100% on the Free tier.

## Quick Start

```bash
npm install @settlegrid/mcp
```

```typescript
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-tool',
  pricing: { defaultCostCents: 5 },
})

// Wrap any handler with billing — MCP tool, REST API, AI agent
const billedHandler = sg.wrap(myHandler)
```

That's it. Every call validates the consumer's API key, checks their credit balance, executes your function, and meters usage — all in under 50ms.

## Why SettleGrid?

| Feature | SettleGrid | Stripe Billing | Nevermined | Paid.ai |
|---|---|---|---|---|
| Protocol support | MCP, x402, AP2, REST | REST only | x402 / DeFi | MCP only |
| Real-time metering | <50ms Redis | Batch only | On-chain | Per-call |
| Multi-hop settlement | Yes | No | Yes | No |
| Agent identity (KYA) | Yes | No | No | No |
| Budget enforcement | Yes | No | No | No |
| Outcome-based billing | Yes | No | Yes | No |
| Open-source SDK | Yes | No | Yes | No |
| Fraud detection | Yes | Yes | No | No |

## Features

- **Sub-50ms metering** — Redis DECRBY on the hot path, async database writeback
- **Per-call billing** — charge per invocation, per token, per byte, per second, tiered, or outcome-based
- **Budget enforcement** — consumers set spending limits, SDK returns HTTP 402 when exceeded
- **Auto-refill credits** — automatic Stripe charges when balance drops below threshold
- **Multi-protocol** — MCP, x402 (Coinbase), AP2 (Google Agent Payments), Visa TAP, any REST API
- **Multi-hop settlement** — atomic settlement across agent chains (A calls B calls C)
- **Agent identity (KYA)** — Know Your Agent verification with trust scoring
- **Fraud detection** — rate spike detection, new-key velocity, duplicate deduplication
- **IP allowlisting** — lock API keys to specific IP ranges and CIDR blocks
- **Webhook events** — HMAC-SHA256 signed event payloads
- **Audit logging** — full audit trail with CSV export for SOC 2 readiness
- **Sandbox mode** — test integrations without real charges

## How It Works

1. **Developer** registers a tool on [settlegrid.ai](https://settlegrid.ai) and sets per-method pricing
2. **Consumer** purchases credits via Stripe and receives an API key (`sg_live_...`)
3. **SDK** wraps your handler — validates key, checks balance, executes, meters
4. **SettleGrid** splits revenue automatically (developer keeps 95%; 0% fee on Free tier)

## REST API Middleware

For non-MCP services (Express, Next.js API routes, etc.):

```typescript
import { settlegridMiddleware } from '@settlegrid/mcp'

const withBilling = settlegridMiddleware({
  toolSlug: 'my-api',
  costCents: 5,
})

// Next.js App Router
export async function GET(request: Request) {
  return withBilling(request, async () => {
    return Response.json({ data: 'hello' })
  })
}
```

## Pricing

| Tier | Price | Operations/month | Take Rate |
|---|---|---|---|
| Free | $0 | 25,000 | 0% (you keep 100%) |
| Starter | $9/mo | 100,000 | 5% |
| Growth | $29/mo | 500,000 | 5% |
| Scale | $79/mo | 2,000,000 | 5% (negotiable) |
| Enterprise | Custom | Unlimited | 3-5% |

## Project Structure

```
settlegrid/
├── apps/web/          # Next.js 15 web platform (settlegrid.ai)
├── packages/mcp/      # @settlegrid/mcp SDK (npm package)
└── turbo.json         # Turborepo config
```

## Links

- **Website**: [settlegrid.ai](https://settlegrid.ai)
- **Documentation**: [settlegrid.ai/docs](https://settlegrid.ai/docs)
- **npm**: [@settlegrid/mcp](https://www.npmjs.com/package/@settlegrid/mcp)
- **API Reference**: [settlegrid.ai/api/openapi.json](https://settlegrid.ai/api/openapi.json)
- **Support**: support@settlegrid.ai

## License

MIT
