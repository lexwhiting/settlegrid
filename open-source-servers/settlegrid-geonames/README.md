# settlegrid-geonames

GeoNames MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-geonames)

Search geographic place names and features from GeoNames with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GEONAMES_USERNAME
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_places(query, max_rows)` | Search for geographic places | 1¢ |
| `get_nearby(lat, lon)` | Find nearby places by coordinates | 1¢ |

## Parameters

### search_places
- `query` (string, required) — Place name to search
- `max_rows` (number, optional) — Max results (1-20, default 10)

### get_nearby
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GEONAMES_USERNAME` | Yes | GeoNames username (free registration) |


## Upstream API

- **Provider**: GeoNames
- **Base URL**: https://api.geonames.org
- **Auth**: Free username required
- **Rate Limits**: 2000 credits/hr
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
