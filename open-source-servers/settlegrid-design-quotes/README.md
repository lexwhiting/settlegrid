# settlegrid-design-quotes

Design Quotes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-design-quotes)

Fetch inspiring design and creativity quotes with search, random selection, and tag filtering.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_random(tag?)` | Get a random quote | 1¢ |
| `search_quotes(query, limit?)` | Search quotes by keyword | 1¢ |
| `list_tags()` | List available quote tags | 1¢ |

## Parameters

### get_random
- `tag` (string) — Optional tag to filter by

### search_quotes
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### list_tags

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DummyJSON Quotes API API — it is completely free.

## Upstream API

- **Provider**: DummyJSON Quotes API
- **Base URL**: https://dummyjson.com/quotes
- **Auth**: None required
- **Docs**: https://dummyjson.com/docs/quotes

## Deploy

### Docker

```bash
docker build -t settlegrid-design-quotes .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-design-quotes
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
