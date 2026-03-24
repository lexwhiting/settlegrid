# settlegrid-nws-alerts

NWS Alerts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nws-alerts)

NOAA National Weather Service severe weather alerts and warnings for the US

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_active_alerts(area)` | Get all active weather alerts for a state | 1¢ |
| `get_alert_types()` | Get all alert types and counts | 1¢ |

## Parameters

### get_active_alerts
- `area` (string, required) — 2-letter state code (e.g. CA, TX)

### get_alert_types

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NWS Alerts API.

## Upstream API

- **Provider**: NWS Alerts
- **Base URL**: https://api.weather.gov
- **Auth**: None required
- **Docs**: https://www.weather.gov/documentation/services-web-api

## Deploy

### Docker

```bash
docker build -t settlegrid-nws-alerts .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nws-alerts
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
