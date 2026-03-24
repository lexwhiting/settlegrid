# settlegrid-opencage

OpenCage MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-opencage)

Geocode and reverse-geocode with OpenCage worldwide geocoding API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENCAGE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `geocode(query)` | Geocode an address | 2¢ |
| `reverse_geocode(lat, lon)` | Reverse geocode coordinates | 2¢ |

## Parameters

### geocode
- `query` (string, required) — Address or place name

### reverse_geocode
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENCAGE_API_KEY` | Yes | OpenCage API key |


## Upstream API

- **Provider**: OpenCage
- **Base URL**: https://api.opencagedata.com/geocode/v1
- **Auth**: Free API key required
- **Rate Limits**: 2,500 req/day
- **Docs**: https://opencagedata.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-opencage .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENCAGE_API_KEY=xxx -p 3000:3000 settlegrid-opencage
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
