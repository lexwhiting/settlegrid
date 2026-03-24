# settlegrid-satellite-tle

Satellite TLE Tracking MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-satellite-tle)

Access satellite Two-Line Element set data via TLE API. Search satellites, get details, and retrieve TLE data for orbit tracking.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_satellites(query, limit?)` | Search satellites by name | 1¢ |
| `get_satellite(id)` | Get satellite info by NORAD ID | 1¢ |
| `get_tle(id)` | Get TLE orbital elements | 2¢ |

## Parameters

### search_satellites
- `query` (string, required) — Satellite name (e.g. "ISS", "Hubble", "Starlink")
- `limit` (number) — Max results (default 10, max 50)

### get_satellite
- `id` (string, required) — NORAD catalog ID (e.g. 25544 for ISS)

### get_tle
- `id` (string, required) — NORAD catalog ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TLE API API — it is completely free.

## Upstream API

- **Provider**: TLE API
- **Base URL**: https://tle.ivanstanojevic.me/api/tle
- **Auth**: None required
- **Docs**: https://tle.ivanstanojevic.me/

## Deploy

### Docker

```bash
docker build -t settlegrid-satellite-tle .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-satellite-tle
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
