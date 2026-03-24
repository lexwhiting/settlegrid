# settlegrid-tide-data

Tidal Predictions MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tide-data)

Access tidal prediction data via NOAA CO-OPS API. Get tide predictions, list stations, and retrieve water levels.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_predictions(station, date?, range?)` | Get tide predictions for a station | 2¢ |
| `list_stations(state?)` | List tide stations | 1¢ |
| `get_levels(station)` | Get observed water levels | 1¢ |

## Parameters

### get_predictions
- `station` (string, required) — Station ID (e.g. 8454000 for Providence)
- `date` (string) — Date (YYYYMMDD). Defaults to today.
- `range` (number) — Hours of data (default 24, max 168)

### list_stations
- `state` (string) — Two-letter state code (e.g. CA, FL)

### get_levels
- `station` (string, required) — Station ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NOAA CO-OPS API API — it is completely free.

## Upstream API

- **Provider**: NOAA CO-OPS API
- **Base URL**: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
- **Auth**: None required
- **Docs**: https://tidesandcurrents.noaa.gov/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-tide-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tide-data
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
