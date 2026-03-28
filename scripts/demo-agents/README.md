# SettleGrid Agent Demo Scripts

Reference agent implementations that prove the SettleGrid workflow is real: agents can discover tools, evaluate pricing, and call paid tools through the marketplace.

## What These Demos Show

Each script demonstrates a complete agent workflow:

1. **Agent receives a task** from a user
2. **Agent discovers tools** via the SettleGrid Discovery API (`/api/v1/discover`)
3. **Agent evaluates pricing** against a budget
4. **Agent selects tools** based on cost, relevance, and popularity
5. **Agent calls tools** (simulated -- tool endpoints may not be live)
6. **Agent returns results** to the user

The discovery API calls are **real** (hitting `https://settlegrid.ai/api/v1/discover`). Tool invocations are **simulated** because tool endpoints may not be running. This is enough to prove that the discovery-to-payment pipeline works.

## Running

```bash
# From the settlegrid repo root:

# Research Agent — discovers data tools for a research question
npx tsx scripts/demo-agents/research-agent.ts
npx tsx scripts/demo-agents/research-agent.ts "What is the GDP of France?"

# Code Review Agent — discovers code analysis tools and runs multi-tool review
npx tsx scripts/demo-agents/code-review-agent.ts

# Content Agent — discovers NLP and image tools for a content pipeline
npx tsx scripts/demo-agents/content-agent.ts
npx tsx scripts/demo-agents/content-agent.ts "Write a blog post about autonomous AI agents"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SETTLEGRID_URL` | `https://settlegrid.ai` | Base URL for the SettleGrid API. Set to `http://localhost:3005` for local development. |

## Architecture

```
scripts/demo-agents/
  lib.ts                  — Shared utilities (discovery, pricing, simulation, logging)
  research-agent.ts       — Agent 1: Research workflow
  code-review-agent.ts    — Agent 2: Code review workflow
  content-agent.ts        — Agent 3: Content creation pipeline
  README.md               — This file
```

### Shared Library (`lib.ts`)

| Function | Description |
|----------|-------------|
| `discoverTools(query, category?, limit?)` | Calls the SettleGrid Discovery API |
| `getToolDetails(slug)` | Fetches full tool info including reviews and changelog |
| `formatPricing(config)` | Formats `{ defaultCostCents: 5 }` into `$0.05/call` |
| `budgetCheck(tools, budgetCents)` | Filters tools that fit within a budget |
| `simulateCall(tool, input)` | Logs what a real invocation would do |
| `costCents(pricing)` | Extracts per-call cost from a pricing config |

## Agent Patterns Demonstrated

### Research Agent
- **Single-tool selection**: finds the best tool for a task
- **Budget constraint**: rejects tools that exceed the budget
- **Relevance mapping**: maps natural language questions to search queries
- **Graceful fallback**: works even when the API returns no results

### Code Review Agent
- **Multi-tool orchestration**: discovers tools across multiple categories (linting, security, quality)
- **Budget allocation**: spreads a budget across tool categories
- **Result aggregation**: combines findings from multiple tools into a unified report

### Content Agent
- **Sequential pipeline**: runs tools in order (research -> sentiment -> writing -> image)
- **Rolling budget**: tracks remaining budget across pipeline stages
- **Cross-category discovery**: searches different tool categories (NLP, image) per stage
- **Context passing**: each stage builds on the output of previous stages

## How This Proves SettleGrid Works

These demos validate the core marketplace thesis:

1. **Discovery works**: Agents can programmatically find tools by querying the API
2. **Pricing is transparent**: Agents can read and compare tool prices before committing
3. **Budget management is possible**: Agents can make cost-aware decisions
4. **Multi-tool workflows are natural**: Agents can compose multiple paid tools into pipelines
5. **The x402 payment model scales**: Per-call pricing fits naturally into agent decision loops
