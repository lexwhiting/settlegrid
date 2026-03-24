# settlegrid-football-data

Football-Data.org MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-football-data)

Soccer/football competitions, standings, and match data from Football-Data.org.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FOOTBALL_DATA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_standings(competition)` | Get league standings/table | 2¢ |
| `get_matches(competition, matchday)` | Get recent/upcoming matches | 2¢ |
| `get_team(team_id)` | Get team details and squad | 2¢ |

## Parameters

### get_standings
- `competition` (string, required) — Competition code (e.g. "PL", "BL1", "SA", "PD", "FL1")

### get_matches
- `competition` (string, required) — Competition code
- `matchday` (number, optional) — Specific matchday number

### get_team
- `team_id` (number, required) — Team ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FOOTBALL_DATA_API_KEY` | Yes | Football-Data.org API key (free tier) |


## Upstream API

- **Provider**: Football-Data.org
- **Base URL**: https://api.football-data.org/v4
- **Auth**: API key (header: X-Auth-Token)
- **Rate Limits**: 10 req/min (free)
- **Docs**: https://www.football-data.org/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-football-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FOOTBALL_DATA_API_KEY=xxx -p 3000:3000 settlegrid-football-data
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
