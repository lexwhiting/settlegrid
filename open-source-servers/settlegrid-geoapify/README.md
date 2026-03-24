# settlegrid-geoapify

Geoapify MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-geoapify)

Geocode addresses and search for places with Geoapify API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GEOAPIFY_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `geocode(text)` | Geocode an address | 2¢ |
| `search_places(categories, lat, lon)` | Search for places of interest | 2¢ |

## Parameters

### geocode
- `text` (string, required) — Address or place name

### search_places
- `categories` (string, required) — Place category (e.g. "catering.restaurant")
- `lat` (number, required) — Center latitude
- `lon` (number, required) — Center longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GEOAPIFY_API_KEY` | Yes | Geoapify API key |


## Upstream API

- **Provider**: Geoapify
- **Base URL**: https://api.geoapify.com/v1
- **Auth**: Free API key required
- **Rate Limits**: 3000 req/day
- **Docs**: https://apidocs.geoapify.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-geoapify .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GEOAPIFY_API_KEY=xxx -p 3000:3000 settlegrid-geoapify
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
