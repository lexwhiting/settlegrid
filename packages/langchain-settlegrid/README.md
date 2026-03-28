# langchain-settlegrid

Use paid SettleGrid tools in LangChain agents. Discover tools from the SettleGrid marketplace and use them as native LangChain `Tool` instances with automatic billing, metering, and usage tracking.

## Install

```bash
npm install langchain-settlegrid @langchain/core
```

## Quick Start

```typescript
import { SettleGridToolkit } from 'langchain-settlegrid'

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
