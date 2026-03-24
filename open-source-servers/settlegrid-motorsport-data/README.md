# settlegrid-motorsport-data

Motorsport Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-motorsport-data)

Formula 1, MotoGP, and motorsport data from Ergast API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_f1_standings(season?)` | Get current F1 driver standings | 1¢ |
| `get_f1_schedule(season?)` | Get F1 race schedule | 1¢ |
| `get_f1_race_result(season, round)` | Get F1 race result | 1¢ |

## Parameters

### get_f1_standings
- `season` (string) — Season year (default: current)

### get_f1_schedule
- `season` (string) — Season year (default: current)

### get_f1_race_result
- `season` (string, required) — Season year
- `round` (string, required) — Round number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Ergast F1 API — it is completely free.

## Upstream API

- **Provider**: Ergast F1
- **Base URL**: https://ergast.com/api/f1
- **Auth**: None required
- **Docs**: https://ergast.com/mrd/

## Deploy

### Docker

```bash
docker build -t settlegrid-motorsport-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-motorsport-data
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
