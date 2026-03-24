# settlegrid-random-quotes

Random Quotes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-random-quotes)

Random inspirational and famous quotes from Quotable API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_random_quote(tag?)` | Get a random quote | 1¢ |
| `search_quotes(query)` | Search quotes by keyword | 1¢ |

## Parameters

### get_random_quote
- `tag` (string) — Tag filter (e.g. technology, wisdom)

### search_quotes
- `query` (string, required) — Search keyword

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Quotable API — it is completely free.

## Upstream API

- **Provider**: Quotable
- **Base URL**: https://api.quotable.io
- **Auth**: None required
- **Docs**: https://docs.quotable.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-random-quotes .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-random-quotes
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
