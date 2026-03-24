# settlegrid-sunrise-sunset

Sunrise-Sunset MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sunrise-sunset)

Get sunrise, sunset, and solar times for any location with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_sun_times(lat, lon, date)` | Get sunrise/sunset for coordinates | 1¢ |

## Parameters

### get_sun_times
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude
- `date` (string, optional) — Date (YYYY-MM-DD, default today)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Sunrise-Sunset.org
- **Base URL**: https://api.sunrise-sunset.org/json
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://sunrise-sunset.org/api

## Deploy

### Docker

```bash
docker build -t settlegrid-sunrise-sunset .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sunrise-sunset
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
