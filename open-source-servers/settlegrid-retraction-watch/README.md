# settlegrid-retraction-watch

Retraction Watch MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-retraction-watch)

Search retracted papers and retraction statistics via OpenAlex filtered for retracted works. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_retractions(query, limit?)` | Search retracted papers | 1¢ |
| `get_retraction(id)` | Get retraction details | 1¢ |
| `get_stats(year?)` | Get retraction statistics | 1¢ |

## Parameters

### search_retractions
- `query` (string, required) — Search query for retracted papers
- `limit` (number) — Max results (default: 10, max: 50)

### get_retraction
- `id` (string, required) — OpenAlex work ID or DOI

### get_stats
- `year` (number) — Filter stats by year

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenAlex API — it is completely free.

## Upstream API

- **Provider**: OpenAlex
- **Base URL**: https://api.openalex.org/works?filter=is_retracted:true
- **Auth**: None required
- **Docs**: https://docs.openalex.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-retraction-watch .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-retraction-watch
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
