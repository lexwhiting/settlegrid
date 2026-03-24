# settlegrid-asteroid-data

Asteroid Tracking Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-asteroid-data)

Access NASA Near Earth Object Web Service (NeoWs) for asteroid tracking. Get feeds, individual asteroids, and statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_feed(startDate, endDate?)` | Get near-Earth asteroids by date range | 2¢ |
| `get_asteroid(id)` | Get asteroid details by ID | 1¢ |
| `get_stats()` | Get NeoWs statistics | 1¢ |

## Parameters

### get_feed
- `startDate` (string, required) — Start date (YYYY-MM-DD)
- `endDate` (string) — End date (YYYY-MM-DD, max 7 days from start)

### get_asteroid
- `id` (string, required) — NASA SPK-ID (e.g. 3542519)

### get_stats

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NASA NeoWs API — it is completely free.

## Upstream API

- **Provider**: NASA NeoWs
- **Base URL**: https://api.nasa.gov/neo/rest/v1
- **Auth**: None required
- **Docs**: https://api.nasa.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-asteroid-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-asteroid-data
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
