# settlegrid-solar-data

NREL Solar Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-solar-data)

Solar irradiance and photovoltaic resource data from NREL.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NREL_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_solar_resource(lat, lon)` | Get solar resource data for a lat/lon | 2¢ |
| `get_pvwatts(lat, lon, system_capacity)` | Estimate PV system energy production | 2¢ |

## Parameters

### get_solar_resource
- `lat` (number, required)
- `lon` (number, required)

### get_pvwatts
- `lat` (number, required)
- `lon` (number, required)
- `system_capacity` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NREL_API_KEY` | Yes | Free key from developer.nrel.gov |


## Upstream API

- **Provider**: NREL
- **Base URL**: https://developer.nrel.gov/api/solar
- **Auth**: Free API key required
- **Rate Limits**: 1000 req/hr
- **Docs**: https://developer.nrel.gov/docs/solar/

## Deploy

### Docker

```bash
docker build -t settlegrid-solar-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NREL_API_KEY=xxx -p 3000:3000 settlegrid-solar-data
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
