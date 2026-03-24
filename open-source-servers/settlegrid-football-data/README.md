# settlegrid-football-data

Football-Data.org MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-football-data)

Soccer data — leagues, standings, fixtures, and scorers.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FOOTBALL_DATA_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_competitions()` | List available soccer competitions | 2¢ |
| `get_standings(competition)` | Get league standings by competition code | 2¢ |
| `get_matches(competition)` | Get matches for a competition | 2¢ |

## Parameters

### get_standings
- `competition` (string, required)

### get_matches
- `competition` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FOOTBALL_DATA_KEY` | Yes | Free key from football-data.org |


## Upstream API

- **Provider**: football-data.org
- **Base URL**: https://api.football-data.org/v4
- **Auth**: Free API key required
- **Rate Limits**: 10 req/min (free)
- **Docs**: https://www.football-data.org/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-football-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FOOTBALL_DATA_KEY=xxx -p 3000:3000 settlegrid-football-data
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
