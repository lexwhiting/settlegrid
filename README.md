<p align="center">
  <a href="https://settlegrid.ai">
    <img src="https://img.shields.io/badge/Settle-Grid-10B981?style=for-the-badge&labelColor=1A1F3A&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxMEI5ODEiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01eiIvPjxwYXRoIGQ9Ik0yIDE3bDEwIDUgMTAtNSIvPjxwYXRoIGQ9Ik0yIDEybDEwIDUgMTAtNSIvPjwvc3ZnPg==" alt="SettleGrid" height="40" />
  </a>
</p>

<h1 align="center">The Settlement Layer for AI Agent Payments</h1>

<p align="center">
  <strong>Monetize any AI tool with 2 lines of code. Per-call billing, 15 protocols, built-in discovery.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@settlegrid/mcp"><img src="https://img.shields.io/npm/v/@settlegrid/mcp.svg?style=flat-square&color=10B981&label=SDK" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@settlegrid/discovery"><img src="https://img.shields.io/npm/v/@settlegrid/discovery.svg?style=flat-square&color=10B981&label=Discovery" alt="npm" /></a>
  <a href="https://registry.modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP_Registry-listed-10B981?style=flat-square" alt="MCP Registry" /></a>
  <a href="https://smithery.ai"><img src="https://img.shields.io/badge/Smithery-listed-10B981?style=flat-square" alt="Smithery" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square" alt="TypeScript" /></a>
</p>

<p align="center">
  <a href="https://settlegrid.ai">Website</a> &middot;
  <a href="https://settlegrid.ai/docs">Docs</a> &middot;
  <a href="https://settlegrid.ai/tools">Showcase</a> &middot;
  <a href="https://settlegrid.ai/servers">1,017 Templates</a> &middot;
  <a href="https://settlegrid.ai/learn/discovery">Discovery Guide</a> &middot;
  <a href="https://settlegrid.ai/learn/handbook">Handbook</a>
</p>

---

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

const billedHandler = sg.wrap(myHandler)
```

Every call validates the consumer's API key, checks their credit balance, executes your function, and meters usage — all in under 50ms.

Or scaffold a complete project instantly:

```bash
npx create-settlegrid-tool
```

<p align="center">
  <img src="https://settlegrid.ai/screenshots/Dashboard%201.jpg" alt="SettleGrid Dashboard" width="800" />
</p>

## Why SettleGrid?

|  | SettleGrid | Stripe Billing | Nevermined | Paid.ai |
|---|:---:|:---:|:---:|:---:|
| **Protocol support** | 15 protocols | REST only | x402 / DeFi | MCP only |
| **Real-time metering** | <50ms Redis | Batch only | On-chain | Per-call |
| **Built-in discovery** | 8+ registries | None | None | None |
| **Multi-hop settlement** | Yes | No | Yes | No |
| **Agent identity (KYA)** | Yes | No | No | No |
| **Budget enforcement** | Yes | No | No | No |
| **Outcome-based billing** | Yes | No | Yes | No |
| **Free tier (0% fees)** | Yes | No | No | No |
| **$1 minimum payout** | Yes | No | No | No |
| **Open-source SDK** | Yes | No | Yes | No |
| **Fraud detection** | Yes | Yes | No | No |

## Discovery — Your Tools, Found Everywhere

SettleGrid doesn't just bill — it distributes. Every active tool is automatically discoverable across:

| Channel | How it works |
|---------|-------------|
| **[Showcase](https://settlegrid.ai/tools)** | Consumers browse, search, and purchase credits |
| **[Discovery API](https://settlegrid.ai/docs#discovery)** | `GET /api/v1/discover` — programmatic search for directories & apps |
| **[MCP Discovery Server](https://www.npmjs.com/package/@settlegrid/discovery)** | AI agents find tools natively via MCP protocol |
| **[HTTP MCP Endpoint](https://settlegrid.ai/api/mcp)** | Remote streamable HTTP transport for any MCP client |
| **[Official MCP Registry](https://registry.modelcontextprotocol.io)** | The canonical MCP server registry |
| **[Smithery](https://smithery.ai)** | 6,000+ MCP server directory |
| **[Glama](https://glama.ai)** | 14,000+ MCP server directory |
| **[RSS Feed](https://settlegrid.ai/api/feed)** | New tools syndicated automatically |

<p align="center">
  <img src="https://settlegrid.ai/screenshots/Showcase.jpg" alt="SettleGrid Showcase" width="800" />
</p>

```json
{
  "mcpServers": {
    "settlegrid-discovery": {
      "command": "npx",
      "args": ["@settlegrid/discovery"]
    }
  }
}
```

## 6 Pricing Models

| Model | Best for | Example |
|-------|----------|---------|
| **Per-Invocation** | Search, lookups, CRUD | 5&cent;/call |
| **Per-Token** | LLM wrappers, text processing | $0.001/1K tokens |
| **Per-Byte** | File conversion, data export | 1&cent;/MB |
| **Per-Second** | Video processing, ML inference | 2&cent;/second |
| **Tiered** | Multi-method tools | read 1&cent;, write 5&cent; |
| **Outcome-Based** | Lead gen, data extraction | 25&cent; on success |

## 10 Payment Protocols

MCP &middot; MPP (Stripe/Tempo) &middot; x402 (Coinbase) &middot; AP2 (Google) &middot; Visa TAP &middot; UCP (Google/Shopify) &middot; ACP (OpenAI) &middot; Mastercard Agent Pay &middot; Circle Nanopayments &middot; REST

## Features

**Billing & Metering**
- Sub-50ms Redis metering on every call
- Budget enforcement — HTTP 402 when exceeded
- Auto-refill credits via Stripe
- Multi-hop atomic settlement across agent chains

**Security & Compliance**
- Agent identity (KYA) with trust scoring
- Fraud detection (12 real-time signals)
- IP allowlisting (CIDR support)
- HMAC-SHA256 webhook signatures
- Audit logging with CSV export (SOC 2 ready)
- Sandbox/test mode

**Developer Experience**
- `sg.wrap()` — one function, any handler
- 6 pricing models configurable from dashboard
- 1,017 open-source templates with billing pre-wired
- CLI scaffolder: `npx create-settlegrid-tool`
- Discovery tab with badge generator, checklist, API URLs
- Consumer reviews with developer responses
- Quality gates + Verified badge for activated tools
- Proactive monitoring (onboarding drip, quality alerts, monthly summary)

## Pricing

| Tier | Price | Ops/month | Take Rate |
|:---:|:---:|:---:|:---:|
| **Free** | $0 forever | 25,000 | 0% |
| **Starter** | $9/mo | 100,000 | 5% |
| **Growth** | $29/mo | 500,000 | 5% |
| **Scale** | $79/mo | 2,000,000 | 5% |

$1 minimum payout — the lowest in the industry. Stripe Connect Express for instant payouts.

## REST API Middleware

For non-MCP services (Express, Next.js, Hono, etc.):

```typescript
import { settlegridMiddleware } from '@settlegrid/mcp'

const withBilling = settlegridMiddleware({
  toolSlug: 'my-api',
  costCents: 5,
})

export async function GET(request: Request) {
  return withBilling(request, async () => {
    return Response.json({ data: 'hello' })
  })
}
```

## Project Structure

```
settlegrid/
├── apps/web/                  # Next.js 15 platform (settlegrid.ai)
├── packages/mcp/              # @settlegrid/mcp SDK
├── packages/discovery-server/ # @settlegrid/discovery MCP server
├── packages/create-tool/      # npx create-settlegrid-tool CLI
├── open-source-servers/       # 1,017 MCP server templates
└── .mcp.json                  # MCP plugin config (Cursor, Claude)
```

## Links

| | |
|---|---|
| **Website** | [settlegrid.ai](https://settlegrid.ai) |
| **Documentation** | [settlegrid.ai/docs](https://settlegrid.ai/docs) |
| **Discovery Guide** | [settlegrid.ai/learn/discovery](https://settlegrid.ai/learn/discovery) |
| **Handbook** | [settlegrid.ai/learn/handbook](https://settlegrid.ai/learn/handbook) |
| **API Reference** | [settlegrid.ai/api/openapi.json](https://settlegrid.ai/api/openapi.json) |
| **Discovery API** | [settlegrid.ai/api/v1/discover](https://settlegrid.ai/api/v1/discover) |
| **RSS Feed** | [settlegrid.ai/api/feed](https://settlegrid.ai/api/feed) |
| **npm (SDK)** | [@settlegrid/mcp](https://www.npmjs.com/package/@settlegrid/mcp) |
| **npm (Discovery)** | [@settlegrid/discovery](https://www.npmjs.com/package/@settlegrid/discovery) |
| **MCP Registry** | [io.github.lexwhiting/settlegrid-discovery](https://registry.modelcontextprotocol.io) |
| **Support** | support@settlegrid.ai |

## License

MIT &copy; 2026 [SettleGrid](https://settlegrid.ai)
