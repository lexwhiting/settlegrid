# settlegrid-nominatim

Nominatim MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nominatim)

Geocode addresses and reverse-geocode coordinates via OpenStreetMap Nominatim with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `geocode(query)` | Geocode an address to coordinates | 1¢ |
| `reverse_geocode(lat, lon)` | Reverse geocode coordinates to address | 1¢ |

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


## Upstream API

- **Provider**: OpenStreetMap
- **Base URL**: https://nominatim.openstreetmap.org
- **Auth**: None required
- **Rate Limits**: 1 req/s
- **Docs**: https://nominatim.org/release-docs/latest/api/Overview/

## Deploy

### Docker

```bash
docker build -t settlegrid-nominatim .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nominatim
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
