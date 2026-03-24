# settlegrid-dimensions

Dimensions Research Analytics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dimensions)

Search publications, get research statistics, and analyze academic output via OpenAlex proxy. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_publications(query, limit?)` | Search scholarly publications | 1¢ |
| `get_publication(id)` | Get publication by ID | 1¢ |
| `get_stats(field?)` | Get research statistics by field | 1¢ |

## Parameters

### search_publications
- `query` (string, required) — Search query for publications
- `limit` (number) — Max results (default: 10, max: 50)

### get_publication
- `id` (string, required) — OpenAlex work ID or DOI

### get_stats
- `field` (string) — Research field to filter (e.g. Medicine, Computer Science)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenAlex API — it is completely free.

## Upstream API

- **Provider**: OpenAlex
- **Base URL**: https://api.openalex.org
- **Auth**: None required
- **Docs**: https://docs.openalex.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-dimensions .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dimensions
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
