# settlegrid-geocoding-api

Geocoding API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-geocoding-api)

Forward and reverse geocoding via Open-Meteo Geocoding API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `geocode_location(name, limit?)` | Geocode a place name to coordinates | 1¢ |

## Parameters

### geocode_location
- `name` (string, required) — Place name or city
- `limit` (number) — Max results (default 5)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo Geocoding API — it is completely free.

## Upstream API

- **Provider**: Open-Meteo Geocoding
- **Base URL**: https://geocoding-api.open-meteo.com/v1
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs/geocoding-api

## Deploy

### Docker

```bash
docker build -t settlegrid-geocoding-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-geocoding-api
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
