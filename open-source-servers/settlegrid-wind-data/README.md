# settlegrid-wind-data

NREL Wind Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wind-data)

Wind energy resource data and toolkit from NREL.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NREL_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_wind_resource(lat, lon)` | Get wind resource data for a location | 2¢ |
| `get_wind_speed(lat, lon)` | Get nearest wind speed data point | 2¢ |

## Parameters

### get_wind_resource
- `lat` (number, required)
- `lon` (number, required)

### get_wind_speed
- `lat` (number, required)
- `lon` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NREL_API_KEY` | Yes | Free key from developer.nrel.gov |


## Upstream API

- **Provider**: NREL
- **Base URL**: https://developer.nrel.gov/api/wind-toolkit
- **Auth**: Free API key required
- **Rate Limits**: 1000 req/hr
- **Docs**: https://developer.nrel.gov/docs/wind/wind-toolkit/

## Deploy

### Docker

```bash
docker build -t settlegrid-wind-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NREL_API_KEY=xxx -p 3000:3000 settlegrid-wind-data
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
