# settlegrid-sourcegraph

Sourcegraph MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sourcegraph)

Search code across repositories using the Sourcegraph streaming search API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_code(query: string, display?: number)` | Search code across repositories using Sourcegraph query syntax | 2¢ |

## Parameters

### search_code
- `query` (string, required) — Sourcegraph search query (e.g. 'repo:myorg/myrepo function main lang:go')
- `display` (number) — Maximum number of results to return (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SOURCEGRAPH_TOKEN` | Yes | Sourcegraph API key from [https://sourcegraph.com/user/settings/tokens](https://sourcegraph.com/user/settings/tokens) |

## Upstream API

- **Provider**: Sourcegraph
- **Base URL**: https://sourcegraph.com
- **Auth**: API key required
- **Docs**: https://sourcegraph.com/docs/api/stream-api

## Deploy

### Docker

```bash
docker build -t settlegrid-sourcegraph .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sourcegraph
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
