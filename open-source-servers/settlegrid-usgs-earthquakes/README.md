# settlegrid-usgs-earthquakes

USGS Earthquakes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usgs-earthquakes)

Query real-time earthquake data from USGS with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_recent_earthquakes(min_magnitude, limit)` | Get recent significant earthquakes | 1¢ |
| `get_earthquake(event_id)` | Get earthquake details by event ID | 1¢ |

## Parameters

### get_recent_earthquakes
- `min_magnitude` (number, optional) — Minimum magnitude (default 4.5)
- `limit` (number, optional) — Max results (1-20, default 10)

### get_earthquake
- `event_id` (string, required) — USGS event ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: USGS
- **Base URL**: https://earthquake.usgs.gov/fdsnws/event/1
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://earthquake.usgs.gov/fdsnws/event/1/

## Deploy

### Docker

```bash
docker build -t settlegrid-usgs-earthquakes .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usgs-earthquakes
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
