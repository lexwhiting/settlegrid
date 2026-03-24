# settlegrid-exoplanet

Exoplanet Archive MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-exoplanet)

Access NASA Exoplanet Archive via TAP service. Search exoplanets, get statistics, and filter by discovery method.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_planets(query?, limit?)` | Search confirmed exoplanets | 1¢ |
| `get_stats()` | Get exoplanet discovery statistics | 1¢ |
| `get_by_method(method, limit?)` | Get exoplanets by discovery method | 2¢ |

## Parameters

### search_planets
- `query` (string) — Planet name or host star (e.g. "Kepler", "TRAPPIST")
- `limit` (number) — Max results (default 10, max 100)

### get_stats

### get_by_method
- `method` (string, required) — Discovery method (e.g. "Transit", "Radial Velocity")
- `limit` (number) — Max results (default 20, max 100)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NASA Exoplanet Archive TAP API — it is completely free.

## Upstream API

- **Provider**: NASA Exoplanet Archive TAP
- **Base URL**: https://exoplanetarchive.ipac.caltech.edu/TAP/sync
- **Auth**: None required
- **Docs**: https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html

## Deploy

### Docker

```bash
docker build -t settlegrid-exoplanet .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-exoplanet
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
