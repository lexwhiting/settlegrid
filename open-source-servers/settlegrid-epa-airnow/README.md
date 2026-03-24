# settlegrid-epa-airnow

EPA AirNow MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-epa-airnow)

US air quality index (AQI) observations and forecasts from EPA

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + AIRNOW_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current(zipCode)` | Get current AQI by zip code | 1¢ |
| `get_forecast(zipCode)` | Get AQI forecast by zip code | 1¢ |

## Parameters

### get_current
- `zipCode` (string, required) — US zip code
- `distance` (number, optional) — Search radius in miles (default: 25)

### get_forecast
- `zipCode` (string, required) — US zip code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AIRNOW_API_KEY` | Yes | EPA AirNow API key from [https://docs.airnowapi.org/account/request/](https://docs.airnowapi.org/account/request/) |

## Upstream API

- **Provider**: EPA AirNow
- **Base URL**: https://www.airnowapi.org
- **Auth**: API key (query)
- **Docs**: https://docs.airnowapi.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-epa-airnow .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e AIRNOW_API_KEY=xxx -p 3000:3000 settlegrid-epa-airnow
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
