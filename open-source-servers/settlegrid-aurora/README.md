# settlegrid-aurora

Aurora Forecast Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-aurora)

Access aurora borealis forecast data via NOAA SWPC. Get aurora forecasts, Kp index, and OVATION aurora maps.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_forecast()` | Get aurora forecast | 1¢ |
| `get_kp_index()` | Get current Kp geomagnetic index | 1¢ |
| `get_ovation_map()` | Get OVATION aurora probability map | 2¢ |

## Parameters

### get_forecast

### get_kp_index

### get_ovation_map

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NOAA SWPC API — it is completely free.

## Upstream API

- **Provider**: NOAA SWPC
- **Base URL**: https://services.swpc.noaa.gov
- **Auth**: None required
- **Docs**: https://www.swpc.noaa.gov/products-and-data

## Deploy

### Docker

```bash
docker build -t settlegrid-aurora .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-aurora
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
