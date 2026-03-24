# settlegrid-star-catalog

Star & Constellation Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-star-catalog)

Access star and constellation data via Le Systeme Solaire API. List constellations, search stars, and get constellation details.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_constellations()` | List all constellations | 1¢ |
| `search_stars(query, limit?)` | Search stars by name | 1¢ |
| `get_constellation(id)` | Get constellation details by ID | 1¢ |

## Parameters

### list_constellations

### search_stars
- `query` (string, required) — Star name or keyword (e.g. "Sirius", "Alpha")
- `limit` (number) — Max results (default 10, max 50)

### get_constellation
- `id` (string, required) — Constellation ID (e.g. "ori" for Orion)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Le Systeme Solaire API API — it is completely free.

## Upstream API

- **Provider**: Le Systeme Solaire API
- **Base URL**: https://api.le-systeme-solaire.net/rest
- **Auth**: None required
- **Docs**: https://api.le-systeme-solaire.net/

## Deploy

### Docker

```bash
docker build -t settlegrid-star-catalog .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-star-catalog
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
