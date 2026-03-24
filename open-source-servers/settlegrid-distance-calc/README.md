# settlegrid-distance-calc

Distance Calculator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-distance-calc)

Calculate distances between coordinates using the Haversine formula.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `calc_distance(lat1, lon1, lat2, lon2)` | Calculate distance between two points | 1¢ |

## Parameters

### calc_distance
- `lat1` (number, required) — Origin latitude
- `lon1` (number, required) — Origin longitude
- `lat2` (number, required) — Destination latitude
- `lon2` (number, required) — Destination longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Local Calculation API — it is completely free.

## Upstream API

- **Provider**: Local Calculation
- **Base URL**: https://local
- **Auth**: None required
- **Docs**: https://en.wikipedia.org/wiki/Haversine_formula

## Deploy

### Docker

```bash
docker build -t settlegrid-distance-calc .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-distance-calc
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
