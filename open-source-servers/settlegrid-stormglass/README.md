# settlegrid-stormglass

Storm Glass MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-stormglass)

Marine weather data including waves, tides, and ocean conditions

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + STORMGLASS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_weather(lat, lng)` | Get point-based marine weather data | 2¢ |
| `get_tide(lat, lng)` | Get tide extremes (highs and lows) | 2¢ |

## Parameters

### get_weather
- `lat` (number, required) — Latitude
- `lng` (number, required) — Longitude
- `params` (string, optional) — Comma-separated: waveHeight,windSpeed,waterTemperature

### get_tide
- `lat` (number, required) — Latitude
- `lng` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `STORMGLASS_API_KEY` | Yes | Storm Glass API key from [https://stormglass.io/](https://stormglass.io/) |

## Upstream API

- **Provider**: Storm Glass
- **Base URL**: https://api.stormglass.io/v2
- **Auth**: API key (header)
- **Docs**: https://docs.stormglass.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-stormglass .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e STORMGLASS_API_KEY=xxx -p 3000:3000 settlegrid-stormglass
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
