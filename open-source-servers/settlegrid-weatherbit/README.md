# settlegrid-weatherbit

Weatherbit MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weatherbit)

Current weather, forecasts, and severe weather alerts worldwide

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WEATHERBIT_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current(city)` | Get current weather data | 1¢ |
| `get_forecast_daily(city)` | Get 16-day daily forecast | 2¢ |

## Parameters

### get_current
- `city` (string, required) — City name

### get_forecast_daily
- `city` (string, required) — City name
- `days` (number, optional) — Number of days (1-16) (default: 7)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WEATHERBIT_API_KEY` | Yes | Weatherbit API key from [https://www.weatherbit.io/account/create](https://www.weatherbit.io/account/create) |

## Upstream API

- **Provider**: Weatherbit
- **Base URL**: https://api.weatherbit.io/v2.0
- **Auth**: API key (query)
- **Docs**: https://www.weatherbit.io/api

## Deploy

### Docker

```bash
docker build -t settlegrid-weatherbit .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WEATHERBIT_API_KEY=xxx -p 3000:3000 settlegrid-weatherbit
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
