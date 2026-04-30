# @settlegrid/n8n

**Billing adapter for n8n.** Two integration modes:

1. **Developer-side (`wrapN8nTool`)** — wrap your custom n8n node's execute logic with per-invocation SettleGrid billing. Use this when you're *building* a paid n8n node.
2. **Consumer-side (SettleGrid community node)** — discover, browse, and invoke existing monetized AI tools from your n8n workflows.

## Installation

Install via the n8n community nodes panel, or manually:

```bash
npm install @settlegrid/n8n @settlegrid/mcp
```

Then restart n8n. The SettleGrid node will appear in the node palette.

## Developer usage — `wrapN8nTool`

Wrap your node's execute function so each call is billed. The API key is sourced from the node's SettleGrid credential and passed in via `context.settlegridKey`.

```typescript
import type { IExecuteFunctions } from 'n8n-workflow'
import { wrapN8nTool } from '@settlegrid/n8n'

const billedExecute = wrapN8nTool(
  async (input: { query: string }) => {
    const result = await doWork(input.query)
    return { ok: true, result }
  },
  { toolSlug: 'my-n8n-tool', pricing: { defaultCostCents: 3 } },
)

// Inside your node's execute():
export async function execute(this: IExecuteFunctions) {
  const creds = await this.getCredentials('settleGridApi')
  const query = this.getNodeParameter('query', 0) as string
  const result = await billedExecute(
    { query },
    { settlegridKey: creds.apiKey as string },
  )
  return [this.helpers.returnJsonArray([result])]
}
```

Errors surface as `InvalidKeyError` (401) and `InsufficientCreditsError` (402).

## Consumer usage — SettleGrid community node

## Credentials

Create a **SettleGrid API** credential with your API key from the [SettleGrid developer dashboard](https://settlegrid.ai/dashboard).

## Available Operations

### Tool

| Operation | Description |
|-----------|-------------|
| **List Tools** | Search and paginate the tool marketplace. Filter by query, category, and sort order. |
| **Get Tool** | Fetch full details for a specific tool by its slug, including reviews and changelog. |
| **List Categories** | List all tool categories with active tool counts. |

### Registry (MCP Sub-Registry)

| Operation | Description |
|-----------|-------------|
| **List Servers** | List published MCP servers with search, category, tag, and verification filters. Cursor-based pagination. |
| **Get Server** | Get the latest version of a specific MCP server by name, including reviews, reputation, and changelog. |

## Pricing

SettleGrid uses a progressive take rate model — developers keep more as they grow:

| Monthly Revenue | Take Rate | Developer Keeps |
|-----------------|-----------|-----------------|
| $0 - $1,000 | 0% | 100% |
| $1,001 - $10,000 | 2% | 98% |
| $10,001 - $50,000 | 3% | 97% |
| $50,001+ | 5% | 95% |

**Free tier:** 50,000 ops/month, unlimited tools, no credit card required.
**Builder tier:** $19/month for 500,000 ops/month.

## Links

- [SettleGrid](https://settlegrid.ai)
- [API Documentation](https://settlegrid.ai/docs)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
