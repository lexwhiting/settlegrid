# Example: fastmcp Server with 3 Tools

A `fastmcp` server exposing three tools — search, summarize, and translate — wrapped with per-method billing.

## Before

```typescript
import { FastMCP } from 'fastmcp'
import { z } from 'zod'

const server = new FastMCP({ name: 'text-tools', version: '1.0.0' })

server.addTool({
  name: 'search_web',
  description: 'Search the web',
  parameters: z.object({ query: z.string(), limit: z.number().optional() }),
  execute: async ({ query, limit }) => {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`)
    const data = await res.json()
    const results = data.RelatedTopics?.slice(0, limit ?? 5) ?? []
    return JSON.stringify(results.map((r: { Text: string }) => r.Text))
  },
})

server.addTool({
  name: 'summarize',
  description: 'Summarize a block of text',
  parameters: z.object({ text: z.string() }),
  execute: async ({ text }) => {
    const sentences = text.split('. ')
    return sentences.slice(0, 3).join('. ') + '.'
  },
})

server.addTool({
  name: 'translate',
  description: 'Translate text to another language',
  parameters: z.object({ text: z.string(), target_lang: z.string() }),
  execute: async ({ text, target_lang }) => {
    return `[${target_lang}] ${text}`
  },
})

server.start({ transportType: 'stdio' })
```

## After

```typescript
import { FastMCP } from 'fastmcp'
import { z } from 'zod'
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'text-tools',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_web: { costCents: 2, displayName: 'Web Search' },
      summarize: { costCents: 1, displayName: 'Summarize' },
      translate: { costCents: 3, displayName: 'Translate' },
    },
  },
})

const searchWeb = sg.wrap(
  async (args: { query: string; limit?: number }) => {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json`)
    const data = await res.json()
    const results = data.RelatedTopics?.slice(0, args.limit ?? 5) ?? []
    return JSON.stringify(results.map((r: { Text: string }) => r.Text))
  },
  { method: 'search_web' }
)

const summarize = sg.wrap(
  async (args: { text: string }) => {
    const sentences = args.text.split('. ')
    return sentences.slice(0, 3).join('. ') + '.'
  },
  { method: 'summarize' }
)

const translate = sg.wrap(
  async (args: { text: string; target_lang: string }) => {
    return `[${args.target_lang}] ${args.text}`
  },
  { method: 'translate' }
)

const server = new FastMCP({ name: 'text-tools', version: '1.0.0' })

server.addTool({
  name: 'search_web',
  description: 'Search the web',
  parameters: z.object({ query: z.string(), limit: z.number().optional() }),
  execute: async (args) => {
    return searchWeb(args, { metadata: { 'settlegrid-api-key': process.env.SETTLEGRID_API_KEY } })
  },
})

server.addTool({
  name: 'summarize',
  description: 'Summarize a block of text',
  parameters: z.object({ text: z.string() }),
  execute: async (args) => {
    return summarize(args, { metadata: { 'settlegrid-api-key': process.env.SETTLEGRID_API_KEY } })
  },
})

server.addTool({
  name: 'translate',
  description: 'Translate text to another language',
  parameters: z.object({ text: z.string(), target_lang: z.string() }),
  execute: async (args) => {
    return translate(args, { metadata: { 'settlegrid-api-key': process.env.SETTLEGRID_API_KEY } })
  },
})

server.start({ transportType: 'stdio' })
```

### Key Changes

- **Line 3, 5-17**: Added SDK import and `settlegrid.init()` with differentiated pricing (search costs more than summarize).
- **Lines 19-40**: Each handler is extracted into a named `sg.wrap()` call with typed args and a `method` key.
- **Lines 44-70**: `server.addTool` execute functions delegate to the wrapped handlers, passing the API key from the environment via MCP metadata.

### Dashboard View

The SettleGrid dashboard groups calls by method name. The "Web Search" row shows higher revenue per call (2c) even if it has fewer invocations than "Summarize" (1c). The dashboard's "Revenue by Method" pie chart makes it obvious which tools drive the most income, helping the operator decide where to invest in quality.

### Revenue Math

- **Calls/day**: 1,000 (search 300, summarize 500, translate 200)
- **Weighted average**: (300×2 + 500×1 + 200×3) / 1000 = 1.7 cents/call
- **Projected monthly**: 1,000 × 1.7 × 30 = **$510/month**
