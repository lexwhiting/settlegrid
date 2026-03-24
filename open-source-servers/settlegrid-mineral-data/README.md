# settlegrid-mineral-data

Mineral Database MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mineral-data)

Access mineral data via Mindat API. Search minerals, get details, and list chemical groups.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_minerals(query, limit?)` | Search minerals by name | 1¢ |
| `get_mineral(id)` | Get mineral details by ID | 1¢ |
| `list_chemical_groups()` | List mineral chemical groups | 1¢ |

## Parameters

### search_minerals
- `query` (string, required) — Mineral name (e.g. "quartz", "feldspar")
- `limit` (number) — Max results (default 10, max 50)

### get_mineral
- `id` (string, required) — Mindat mineral ID

### list_chemical_groups

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Mindat API API — it is completely free.

## Upstream API

- **Provider**: Mindat API
- **Base URL**: https://api.mindat.org
- **Auth**: None required
- **Docs**: https://api.mindat.org/schema/redoc/

## Deploy

### Docker

```bash
docker build -t settlegrid-mineral-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mineral-data
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
