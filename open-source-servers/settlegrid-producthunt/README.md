# settlegrid-producthunt

Product Hunt MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-producthunt)

Discover new tech products via Product Hunt GraphQL API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PRODUCTHUNT_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_posts(first)` | Get top Product Hunt posts | 2¢ |
| `search_posts(query)` | Search Product Hunt | 2¢ |

## Parameters

### get_posts
- `first` (number, optional) — Max results (1-20, default 10)

### search_posts
- `query` (string, required) — Search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PRODUCTHUNT_TOKEN` | Yes | Product Hunt developer token |


## Upstream API

- **Provider**: Product Hunt
- **Base URL**: https://api.producthunt.com/v2/api/graphql
- **Auth**: Bearer token required
- **Rate Limits**: 450 req/15min
- **Docs**: https://api.producthunt.com/v2/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-producthunt .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PRODUCTHUNT_TOKEN=xxx -p 3000:3000 settlegrid-producthunt
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
