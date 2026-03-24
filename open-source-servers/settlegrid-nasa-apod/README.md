# settlegrid-nasa-apod

NASA APOD MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nasa-apod)

NASA Astronomy Picture of the Day with high-resolution images

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NASA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_today()` | Get today's Astronomy Picture of the Day | 1¢ |
| `get_by_date(date)` | Get APOD for a specific date | 1¢ |

## Parameters

### get_today

### get_by_date
- `date` (string, required) — Date in YYYY-MM-DD format

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NASA_API_KEY` | No | NASA APOD API key from [https://api.nasa.gov/](https://api.nasa.gov/) |

## Upstream API

- **Provider**: NASA APOD
- **Base URL**: https://api.nasa.gov
- **Auth**: API key (query)
- **Docs**: https://api.nasa.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-nasa-apod .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NASA_API_KEY=xxx -p 3000:3000 settlegrid-nasa-apod
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
