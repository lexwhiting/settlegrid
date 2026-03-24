# settlegrid-loc

Library of Congress MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-loc)

Search the Library of Congress digital collections, items, and resources via their JSON API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_items(query, limit?)` | Search Library of Congress items | 1¢ |
| `get_item(id)` | Get item by LOC ID | 1¢ |
| `search_collections(query)` | Search LOC collections | 1¢ |

## Parameters

### search_items
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_item
- `id` (string, required) — Library of Congress item ID or URL path

### search_collections
- `query` (string, required) — Collection search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Library of Congress API API — it is completely free.

## Upstream API

- **Provider**: Library of Congress API
- **Base URL**: https://www.loc.gov
- **Auth**: None required
- **Docs**: https://www.loc.gov/apis/

## Deploy

### Docker

```bash
docker build -t settlegrid-loc .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-loc
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
