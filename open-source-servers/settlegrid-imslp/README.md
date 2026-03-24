# settlegrid-imslp

IMSLP Sheet Music MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-imslp)

Search the International Music Score Library Project (Petrucci) for public domain sheet music, scores, and composers.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_works(query, limit?)` | Search IMSLP musical works | 1¢ |
| `get_work(title)` | Get work details by title | 1¢ |
| `search_composers(query)` | Search IMSLP composers | 1¢ |

## Parameters

### search_works
- `query` (string, required) — Search query for musical works
- `limit` (number) — Max results (default 10)

### get_work
- `title` (string, required) — Exact IMSLP page title of the work

### search_composers
- `query` (string, required) — Composer name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream IMSLP MediaWiki API API — it is completely free.

## Upstream API

- **Provider**: IMSLP MediaWiki API
- **Base URL**: https://imslp.org/api.php
- **Auth**: None required
- **Docs**: https://imslp.org/wiki/IMSLP:API

## Deploy

### Docker

```bash
docker build -t settlegrid-imslp .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-imslp
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
