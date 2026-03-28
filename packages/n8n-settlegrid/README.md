# n8n-nodes-settlegrid

n8n community node for [SettleGrid](https://settlegrid.ai) — discover, browse, and invoke monetized AI tools from your n8n workflows.

## Installation

Install via the n8n community nodes panel, or manually:

```bash
npm install n8n-nodes-settlegrid
```

Then restart n8n. The SettleGrid node will appear in the node palette.

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
