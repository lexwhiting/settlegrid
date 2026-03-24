# settlegrid-icon-search

Icon Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-icon-search)

Search and retrieve icons from 150,000+ open source icons via the Iconify API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_icons(query, limit?)` | Search icons by keyword | 1¢ |
| `get_icon(prefix, name)` | Get icon SVG data | 1¢ |
| `list_collections()` | List icon collections | 1¢ |

## Parameters

### search_icons
- `query` (string, required) — Icon search query
- `limit` (number) — Max results (default 20)

### get_icon
- `prefix` (string, required) — Icon set prefix (e.g. mdi, fa)
- `name` (string, required) — Icon name within the set

### list_collections

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Iconify API API — it is completely free.

## Upstream API

- **Provider**: Iconify API
- **Base URL**: https://api.iconify.design
- **Auth**: None required
- **Docs**: https://iconify.design/docs/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-icon-search .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-icon-search
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
