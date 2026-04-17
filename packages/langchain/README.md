# @settlegrid/langchain

**Billing adapter for LangChain.** Two integration modes:

1. **Developer-side (`wrapLangchainTool`)** — wrap your local `DynamicStructuredTool` / `Tool` with per-invocation SettleGrid billing. Use this when you're *building* a paid LangChain tool.
2. **Consumer-side (`SettleGridToolkit`)** — discover and invoke existing marketplace tools as native LangChain `Tool` instances. Use this when you want to *use* paid marketplace tools in an agent.

## Install

```bash
npm install @settlegrid/langchain @settlegrid/mcp @langchain/core
```

## Developer usage — `wrapLangchainTool`

Wrap your tool's `func` so each call is billed through SettleGrid. The API key is read from `config.configurable.settlegridKey` at invocation time.

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools'
import { wrapLangchainTool } from '@settlegrid/langchain'
import { z } from 'zod'

const billedFunc = wrapLangchainTool(
  async (input: { query: string }) => {
    const data = await doExpensiveWork(input.query)
    return JSON.stringify(data)
  },
  { toolSlug: 'my-search', pricing: { defaultCostCents: 2 } },
)

export const mySearch = new DynamicStructuredTool({
  name: 'my-search',
  description: 'Search the web (paid)',
  schema: z.object({ query: z.string() }),
  func: billedFunc,
})

// At runtime, pass the API key via RunnableConfig:
const result = await mySearch.invoke(
  { query: 'hello' },
  { configurable: { settlegridKey: 'sg_live_...' } },
)
```

Errors surface as `InvalidKeyError` (401) and `InsufficientCreditsError` (402) from `@settlegrid/mcp`.

## Consumer usage — `SettleGridToolkit`

```typescript
import { SettleGridToolkit } from '@settlegrid/langchain'

const toolkit = new SettleGridToolkit({ apiKey: 'sg_...' })

// Discover tools by keyword
const tools = await toolkit.discoverTools('weather')

// Pass tools directly to any LangChain agent
import { ChatOpenAI } from '@langchain/openai'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const llm = new ChatOpenAI({ model: 'gpt-4o' })
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
])

const agent = createToolCallingAgent({ llm, tools, prompt })
const executor = new AgentExecutor({ agent, tools })

const result = await executor.invoke({
  input: 'What is the weather in Tokyo?',
})
```

## Usage

### Discover Tools

```typescript
// Search by keyword
const weatherTools = await toolkit.discoverTools('weather')

// Filter by category
const dataTools = await toolkit.discoverTools(undefined, 'data')

// Combined search + category
const nlpTools = await toolkit.discoverTools('sentiment', 'nlp')
```

### Direct Tool Creation

If you already know the tool slug, skip discovery:

```typescript
const tool = toolkit.createTool(
  'weather-lookup',
  'Get current weather for a city',
  5 // cost in cents per call
)
```

### Access Billing Metadata

After each tool call, cost and latency are available:

```typescript
const result = await tool.invoke('{"city": "Tokyo"}')
console.log(tool.lastInvocationMeta)
// { costCents: 5, latencyMs: 230 }
```

## Configuration

| Option    | Required | Default                  | Description                    |
| --------- | -------- | ------------------------ | ------------------------------ |
| `apiKey`  | Yes      | -                        | Your SettleGrid consumer key   |
| `baseUrl` | No       | `https://settlegrid.ai`  | SettleGrid API base URL        |

## How It Works

1. `discoverTools()` calls the [SettleGrid Discovery API](https://settlegrid.ai/docs#discovery) to find tools matching your query
2. Each discovered tool is wrapped as a LangChain `Tool` with the tool's description surfaced to the LLM
3. When the LLM calls a tool, the `_call` method proxies the request through SettleGrid's billing proxy at `/api/proxy/{slug}`
4. SettleGrid handles authentication, metering, balance checks, and upstream forwarding
5. Cost and latency metadata from each call are available on `tool.lastInvocationMeta`

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

## License

MIT
