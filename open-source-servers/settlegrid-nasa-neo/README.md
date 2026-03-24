# settlegrid-nasa-neo

NASA Near-Earth Objects MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nasa-neo)

Track asteroids and near-Earth objects with approach data from NASA

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NASA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_feed(start_date)` | Get near-Earth objects for a date range | 2¢ |

## Parameters

### get_feed
- `start_date` (string, required) — Start date YYYY-MM-DD
- `end_date` (string, optional) — End date YYYY-MM-DD (max 7 days)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NASA_API_KEY` | No | NASA Near-Earth Objects API key from [https://api.nasa.gov/](https://api.nasa.gov/) |

## Upstream API

- **Provider**: NASA Near-Earth Objects
- **Base URL**: https://api.nasa.gov
- **Auth**: API key (query)
- **Docs**: https://api.nasa.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-nasa-neo .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NASA_API_KEY=xxx -p 3000:3000 settlegrid-nasa-neo
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
