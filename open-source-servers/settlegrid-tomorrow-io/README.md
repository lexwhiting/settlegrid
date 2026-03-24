# settlegrid-tomorrow-io

Tomorrow.io MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tomorrow-io)

Hyper-local weather intelligence with real-time and forecast data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TOMORROW_IO_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_realtime(location)` | Get real-time weather conditions | 1¢ |
| `get_forecast(location)` | Get hourly or daily forecast | 2¢ |

## Parameters

### get_realtime
- `location` (string, required) — lat,lon or city name

### get_forecast
- `location` (string, required) — lat,lon or city name
- `timesteps` (string, optional) — 1h or 1d (default: "1d")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TOMORROW_IO_API_KEY` | Yes | Tomorrow.io API key from [https://www.tomorrow.io/weather-api/](https://www.tomorrow.io/weather-api/) |

## Upstream API

- **Provider**: Tomorrow.io
- **Base URL**: https://api.tomorrow.io/v4
- **Auth**: API key (query)
- **Docs**: https://docs.tomorrow.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-tomorrow-io .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TOMORROW_IO_API_KEY=xxx -p 3000:3000 settlegrid-tomorrow-io
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
