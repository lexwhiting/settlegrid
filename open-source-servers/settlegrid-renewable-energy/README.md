# settlegrid-renewable-energy

Renewable Energy Stats MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-renewable-energy)

Renewable energy generation data via Open-Meteo historical weather for solar/wind potential.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_solar_potential(lat, lon, days?)` | Get solar radiation data | 1¢ |
| `get_wind_potential(lat, lon, days?)` | Get wind energy potential | 1¢ |

## Parameters

### get_solar_potential
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude
- `days` (number) — Forecast days (1-16)

### get_wind_potential
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude
- `days` (number) — Forecast days

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo API — it is completely free.

## Upstream API

- **Provider**: Open-Meteo
- **Base URL**: https://api.open-meteo.com/v1/forecast
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-renewable-energy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-renewable-energy
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
