# settlegrid-ev-charging

Open Charge Map MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ev-charging)

Electric vehicle charging station locations worldwide.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENCHARGEMAP_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_chargers(latitude, longitude, distance)` | Search EV chargers near a lat/lng | 2¢ |
| `get_charger(id)` | Get details for a specific charging location | 2¢ |

## Parameters

### search_chargers
- `latitude` (number, required)
- `longitude` (number, required)
- `distance` (number, optional)

### get_charger
- `id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENCHARGEMAP_API_KEY` | Yes | Free key from openchargemap.org |


## Upstream API

- **Provider**: Open Charge Map
- **Base URL**: https://api.openchargemap.io/v3
- **Auth**: Free API key required
- **Rate Limits**: 100 req/min
- **Docs**: https://openchargemap.org/site/develop/api

## Deploy

### Docker

```bash
docker build -t settlegrid-ev-charging .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENCHARGEMAP_API_KEY=xxx -p 3000:3000 settlegrid-ev-charging
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
