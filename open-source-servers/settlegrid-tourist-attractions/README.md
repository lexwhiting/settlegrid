# settlegrid-tourist-attractions

Tourist Attractions MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tourist-attractions)

Top tourist attractions and sightseeing spots by city.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_attractions(city, limit)` | Get attractions by city | 2¢ |
| `get_attraction_detail(xid)` | Get attraction details | 1¢ |

## Parameters

### get_attractions
- `city` (string, required) — City name
- `limit` (number, optional) — Max results (default 20, max 50)
### get_attraction_detail
- `xid` (string, required) — Attraction identifier from search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: OpenTripMap
- **Base URL**: https://api.opentripmap.com/0.1
- **Auth**: Free API key included
- **Docs**: https://opentripmap.io/docs

## Deploy

### Docker
```bash
docker build -t settlegrid-tourist-attractions .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tourist-attractions
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
