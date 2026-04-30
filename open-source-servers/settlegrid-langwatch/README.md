# settlegrid-langwatch

LangWatch MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-langwatch)

Search, retrieve, and inspect LangWatch traces capturing the full execution of LLM pipelines including spans, evaluations, and metadata.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_traces(query?: string, limit?: number)` | Search and retrieve LangWatch traces | 2¢ |
| `get_trace(traceId: string)` | Retrieve a specific LangWatch trace by ID | 1¢ |

## Parameters

### search_traces
- `query` (string) — Optional search query to filter traces
- `limit` (number) — Maximum number of traces to return (default 20, max 50)

### get_trace
- `traceId` (string, required) — The unique identifier of the trace to retrieve

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LANGWATCH_API_KEY` | Yes | LangWatch API key from [https://langwatch.ai](https://langwatch.ai) |

## Upstream API

- **Provider**: LangWatch
- **Base URL**: https://langwatch.ai
- **Auth**: API key required
- **Docs**: https://langwatch.ai/docs/api-reference/traces/overview

## Deploy

### Docker

```bash
docker build -t settlegrid-langwatch .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-langwatch
```

### Vercel

Click the "Deploy with Vercel" button above, or:

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
