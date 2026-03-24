# settlegrid-energy-monitor

Energy Monitor MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-energy-monitor)

Home energy usage monitoring with real-time and historical data.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_realtime_usage()` | Real-time usage | 1¢ |
| `get_daily_usage(date)` | Daily breakdown | 1¢ |
| `get_devices()` | Detected devices | 1¢ |

## Parameters

### get_daily_usage
- `date` (string, optional) — Date in YYYY-MM-DD format

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Sense Energy / Emporia Vue
- **Auth**: Account credentials

## Deploy

### Docker
```bash
docker build -t settlegrid-energy-monitor .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-energy-monitor
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
