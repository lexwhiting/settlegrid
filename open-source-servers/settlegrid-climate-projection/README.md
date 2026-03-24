# settlegrid-climate-projection

Climate Projections MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-climate-projection)

Climate change projections from CMIP6 via Open-Meteo.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_climate_projection(lat, lon, start_date, end_date)` | Get climate projections | 1¢ |

## Parameters

### get_climate_projection
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude
- `start_date` (string, required) — Start date (YYYY-MM-DD)
- `end_date` (string, required) — End date (YYYY-MM-DD)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo Climate API — it is completely free.

## Upstream API

- **Provider**: Open-Meteo Climate
- **Base URL**: https://climate-api.open-meteo.com/v1/climate
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs/climate-api

## Deploy

### Docker

```bash
docker build -t settlegrid-climate-projection .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-climate-projection
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
