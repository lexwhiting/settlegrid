# settlegrid-f1-data

Formula 1 Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-f1-data)

Formula 1 race results, driver standings, and constructor data from the Ergast API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_driver_standings(season)` | Get current F1 driver standings | 1¢ |
| `get_race_results(season, round)` | Get results for a specific race | 1¢ |
| `get_schedule(season)` | Get the race schedule | 1¢ |

## Parameters

### get_driver_standings
- `season` (string, optional) — Season year (default: current)

### get_race_results
- `season` (string, required) — Season year
- `round` (number, required) — Race round number

### get_schedule
- `season` (string, optional) — Season year (default: current)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Ergast
- **Base URL**: https://ergast.com/api/f1
- **Auth**: None required
- **Rate Limits**: 4 req/sec
- **Docs**: https://ergast.com/mrd/

## Deploy

### Docker

```bash
docker build -t settlegrid-f1-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-f1-data
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
