# settlegrid-visual-crossing

Visual Crossing Weather MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-visual-crossing)

Historical, forecast, and current weather data with 50+ weather metrics

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + VISUAL_CROSSING_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_timeline(location)` | Get weather timeline for a location | 2¢ |

## Parameters

### get_timeline
- `location` (string, required) — City name or lat,lon

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `VISUAL_CROSSING_API_KEY` | Yes | Visual Crossing Weather API key from [https://www.visualcrossing.com/sign-up](https://www.visualcrossing.com/sign-up) |

## Upstream API

- **Provider**: Visual Crossing Weather
- **Base URL**: https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline
- **Auth**: API key (query)
- **Docs**: https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-visual-crossing .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e VISUAL_CROSSING_API_KEY=xxx -p 3000:3000 settlegrid-visual-crossing
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
