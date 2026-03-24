# settlegrid-weatherapi

WeatherAPI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weatherapi)

Real-time weather, forecast, astronomy, and time zone data for any location

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WEATHERAPI_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current(query)` | Get current weather conditions | 1¢ |
| `get_forecast(query)` | Get weather forecast up to 3 days | 2¢ |
| `get_astronomy(query)` | Get sunrise, sunset, moonrise, and moon phase | 1¢ |

## Parameters

### get_current
- `query` (string, required) — City name, zip, IP, or lat,lon

### get_forecast
- `query` (string, required) — City name, zip, IP, or lat,lon
- `days` (number, optional) — Number of forecast days (1-3) (default: 3)

### get_astronomy
- `query` (string, required) — City name, zip, IP, or lat,lon

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WEATHERAPI_KEY` | Yes | WeatherAPI API key from [https://www.weatherapi.com/signup.aspx](https://www.weatherapi.com/signup.aspx) |

## Upstream API

- **Provider**: WeatherAPI
- **Base URL**: https://api.weatherapi.com/v1
- **Auth**: API key (query)
- **Docs**: https://www.weatherapi.com/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-weatherapi .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WEATHERAPI_KEY=xxx -p 3000:3000 settlegrid-weatherapi
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
