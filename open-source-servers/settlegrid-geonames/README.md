# settlegrid-geonames

GeoNames MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-geonames)

Geographical database with 11M+ place names, elevations, and postal codes

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GEONAMES_USERNAME
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(q)` | Search for place names | 1¢ |
| `get_nearby(lat, lng)` | Find nearby places by coordinates | 1¢ |
| `get_timezone(lat, lng)` | Get timezone for coordinates | 1¢ |

## Parameters

### search
- `q` (string, required) — Place name query
- `maxRows` (number, optional) — Max results (default: 20)

### get_nearby
- `lat` (number, required) — Latitude
- `lng` (number, required) — Longitude

### get_timezone
- `lat` (number, required) — Latitude
- `lng` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GEONAMES_USERNAME` | Yes | GeoNames API key from [https://www.geonames.org/login](https://www.geonames.org/login) |

## Upstream API

- **Provider**: GeoNames
- **Base URL**: http://api.geonames.org
- **Auth**: API key (query)
- **Docs**: https://www.geonames.org/export/web-services.html

## Deploy

### Docker

```bash
docker build -t settlegrid-geonames .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GEONAMES_USERNAME=xxx -p 3000:3000 settlegrid-geonames
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
