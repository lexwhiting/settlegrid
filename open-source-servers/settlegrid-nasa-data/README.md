# settlegrid-nasa-data

NASA Open APIs MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nasa-data)

Astronomy Picture of the Day, near-Earth object tracking, and NASA's vast image library. Works out of the box with DEMO_KEY.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_apod()` | Astronomy Picture of the Day | 1¢ |
| `get_neo(startDate, endDate)` | Near-Earth Objects in date range | 2¢ |
| `search_images(query)` | Search NASA image/video library | 1¢ |

## Parameters

### get_apod
- `date` (string, optional) — YYYY-MM-DD (default: today)

### get_neo
- `startDate` (string, required) — Start date YYYY-MM-DD
- `endDate` (string, optional) — End date YYYY-MM-DD (default: start + 7 days)

### search_images
- `query` (string, required) — Search text (e.g. "mars rover", "earth from space")
- `mediaType` (string, optional) — "image", "video", or "audio"
- `limit` (number, optional) — Max results (default 20, max 100)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NASA_API_KEY` | No | Free NASA API key from [api.nasa.gov](https://api.nasa.gov). DEMO_KEY used by default. |

## Upstream API

- **Provider**: NASA
- **Auth**: DEMO_KEY (30 req/hr) or free API key (1000 req/hr)
- **Docs**: https://api.nasa.gov

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
