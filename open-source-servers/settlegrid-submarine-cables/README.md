# settlegrid-submarine-cables

Submarine Cable Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-submarine-cables)

Undersea fiber optic cable routes, landing points, and capacity data from TeleGeography.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_cables(limit?)` | List submarine cables | 1¢ |
| `get_cable(id)` | Get submarine cable details by ID | 1¢ |
| `list_landing_points(country?)` | List cable landing points by country | 1¢ |

## Parameters

### list_cables
- `limit` (number) — Number of cables to return (default 25)

### get_cable
- `id` (string, required) — Cable ID or slug

### list_landing_points
- `country` (string) — Country name to filter landing points

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TeleGeography Submarine Cable Map API — it is completely free.

## Upstream API

- **Provider**: TeleGeography Submarine Cable Map
- **Base URL**: https://api.submarinecablemap.com/api/v3
- **Auth**: None required
- **Docs**: https://www.submarinecablemap.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-submarine-cables .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-submarine-cables
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
