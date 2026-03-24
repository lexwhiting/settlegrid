# settlegrid-quotable

Quotable MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-quotable)

Get random quotes and search by author or tag with Quotable API via SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_random_quote(tags)` | Get a random quote | 1¢ |
| `search_quotes(query, limit)` | Search quotes by content | 1¢ |

## Parameters

### get_random_quote
- `tags` (string, optional) — Comma-separated tags

### search_quotes
- `query` (string, required) — Search query
- `limit` (number, optional) — Max results (1-20, default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Quotable
- **Base URL**: https://api.quotable.io
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://github.com/lukePeavey/quotable

## Deploy

### Docker

```bash
docker build -t settlegrid-quotable .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-quotable
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
