# settlegrid-nasa-mars

NASA Mars Rover Photos MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nasa-mars)

Photos from NASA Mars rovers (Curiosity, Opportunity, Spirit)

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NASA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_photos(rover, sol)` | Get Mars rover photos by sol or date | 1¢ |

## Parameters

### get_photos
- `rover` (string, required) — Rover name: curiosity, opportunity, spirit
- `sol` (number, required) — Martian sol (day) number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NASA_API_KEY` | No | NASA Mars Rover Photos API key from [https://api.nasa.gov/](https://api.nasa.gov/) |

## Upstream API

- **Provider**: NASA Mars Rover Photos
- **Base URL**: https://api.nasa.gov
- **Auth**: API key (query)
- **Docs**: https://api.nasa.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-nasa-mars .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NASA_API_KEY=xxx -p 3000:3000 settlegrid-nasa-mars
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
