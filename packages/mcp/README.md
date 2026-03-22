# @settlegrid/mcp

**The Settlement Layer for the AI Economy** — monetize any AI service with one line of code.

[![npm version](https://img.shields.io/npm/v/@settlegrid/mcp.svg)](https://www.npmjs.com/package/@settlegrid/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

SettleGrid enables developers to add per-call billing to MCP tools, REST APIs, AI agents, and model endpoints. Real-time Redis metering, automated Stripe payouts, and multi-protocol settlement (MCP, x402, AP2, Visa TAP).

## Quick Start

```bash
npm install @settlegrid/mcp
```

```typescript
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-tool',
  pricing: {
    defaultCostCents: 1,
    methods: {
      'search': { costCents: 5 },
      'analyze': { costCents: 10 },
    },
  },
})

// Wrap any MCP tool handler with billing
const billedHandler = sg.wrap(myHandler, { method: 'search' })
```

That's it. Every call to `billedHandler` validates the consumer's API key, checks their credit balance, executes your function, and meters the usage — all in under 50ms.

## How It Works

1. **Developer** registers a tool on [settlegrid.ai](https://settlegrid.ai) and sets per-method pricing
2. **Consumer** purchases credits via Stripe and receives an API key (`sg_live_...`)
3. **SDK** wraps your tool handler — validates key, checks balance, executes, meters
4. **SettleGrid** splits revenue automatically (85% to developer, 15% platform fee)

## Features

- **Sub-50ms metering** — Redis DECRBY on the hot path, async DB writeback
- **Per-method pricing** — different costs for different operations
- **Budget enforcement** — consumers set spending limits, get HTTP 402 when exceeded
- **Auto-refill** — automatic Stripe charges when balance drops below threshold
- **LRU cache** — key validation cached for 5 minutes (configurable)
- **Fire-and-forget metering** — doesn't block your response
- **6 pricing models** — per-invocation, per-token, per-byte, per-second, tiered, outcome-based

## REST API Middleware

For non-MCP services (Express, Next.js API routes):

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

## MCP Payment Capability

Declare billing support in your MCP server's capabilities:

```typescript
import { createPaymentCapability } from '@settlegrid/mcp'

const server = new Server({
  capabilities: {
    experimental: {
      payment: createPaymentCapability({
        toolSlug: 'my-tool',
        pricing: {
          model: 'per-invocation',
          defaultCostCents: 5,
          currencyCode: 'USD',
        },
      }),
    },
  },
})
```

## MCP Server Card

Generate `.well-known/mcp-server` billing metadata:

```typescript
import { generateServerCard } from '@settlegrid/mcp'

const card = generateServerCard({
  name: 'My Tool',
  version: '1.0.0',
  description: 'A useful AI tool',
  tools: [{ name: 'search', description: 'Search the web', inputSchema: {} }],
  billing: {
    toolSlug: 'my-tool',
    pricing: { model: 'per-invocation', defaultCostCents: 5, currencyCode: 'USD' },
  },
})
```

## API Key Extraction

The SDK extracts API keys from multiple sources (priority order):

1. MCP `_meta['settlegrid-api-key']`
2. `Authorization: Bearer sg_live_...` header
3. `x-api-key` header

```typescript
import { extractApiKey } from '@settlegrid/mcp'

const key = extractApiKey(headers, metadata) // returns string | null
```

## Error Handling

The SDK throws typed errors you can catch:

```typescript
import {
  InvalidKeyError,        // 401 — key doesn't exist or is revoked
  InsufficientCreditsError, // 402 — balance too low
  ToolNotFoundError,       // 404 — tool slug not registered
  ToolDisabledError,       // 403 — tool is deactivated
  RateLimitedError,        // 429 — too many requests
  TimeoutError,            // 503 — request timed out
  NetworkError,            // 503 — connection failed
} from '@settlegrid/mcp'
```

## Configuration

```typescript
settlegrid.init({
  toolSlug: 'my-tool',      // Required — registered on settlegrid.ai
  pricing: { ... },          // Required — pricing configuration
  apiUrl: 'https://settlegrid.ai', // Optional — API base URL
  debug: false,              // Optional — sync metering + console logs
  cacheTtlMs: 300000,       // Optional — key validation cache TTL (5 min default)
  timeoutMs: 5000,           // Optional — API request timeout (5s default)
})
```

## Pricing Models

```typescript
// Per-invocation (default)
{ model: 'per-invocation', defaultCostCents: 5 }

// Per-token (LLM proxies)
{ model: 'per-token', defaultCostCents: 1 }

// Tiered (volume discounts)
{ model: 'tiered', defaultCostCents: 1, tiers: [
  { upTo: 1000, costCents: 2 },
  { upTo: 10000, costCents: 1 },
]}

// Outcome-based (pay for results)
{ model: 'outcome', defaultCostCents: 0, outcomeConfig: {
  successCostCents: 50,
  failureCostCents: 0,
  successCondition: 'result.success === true',
}}
```

## Protocol Support

SettleGrid is protocol-agnostic. This SDK supports:

- **MCP** (Model Context Protocol) — native `wrap()` integration
- **REST APIs** — `settlegridMiddleware()` for any HTTP endpoint
- **x402** (Coinbase) — facilitator endpoints at `/api/x402/verify` and `/api/x402/settle`
- **AP2** (Google Agent Payments) — credentials provider at `/api/a2a/skills`
- **Visa TAP** — adapter ready (pending sandbox access)

## Links

- **Website**: [settlegrid.ai](https://settlegrid.ai)
- **Documentation**: [settlegrid.ai/docs](https://settlegrid.ai/docs)
- **API Reference**: [settlegrid.ai/api/openapi.json](https://settlegrid.ai/api/openapi.json)
- **GitHub**: [github.com/lexwhiting/settlegrid](https://github.com/lexwhiting/settlegrid)
- **Support**: support@settlegrid.ai

## License

MIT
