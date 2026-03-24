# settlegrid-here

HERE Maps MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-here)

Geocoding, routing, and place search from HERE Technologies

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + HERE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `geocode(q)` | Geocode an address | 1¢ |
| `reverse_geocode(at)` | Reverse geocode coordinates | 1¢ |

## Parameters

### geocode
- `q` (string, required) — Address to geocode

### reverse_geocode
- `at` (string, required) — Coordinates as lat,lng

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HERE_API_KEY` | Yes | HERE Maps API key from [https://developer.here.com/sign-up](https://developer.here.com/sign-up) |

## Upstream API

- **Provider**: HERE Maps
- **Base URL**: https://geocode.search.hereapi.com/v1
- **Auth**: API key (query)
- **Docs**: https://developer.here.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-here .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e HERE_API_KEY=xxx -p 3000:3000 settlegrid-here
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
