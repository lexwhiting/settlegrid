# settlegrid-fifa

FIFA Rankings & Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fifa)

FIFA world rankings, competitions, and international football data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FOOTBALL_DATA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_world_cup_standings()` | Get FIFA World Cup group standings | 2¢ |
| `get_competition_teams(competition)` | Get teams in a FIFA competition | 2¢ |
| `get_competition_matches(competition)` | Get matches in a FIFA competition | 2¢ |

## Parameters

### get_competition_teams
- `competition` (string, required) — Competition code: "WC" (World Cup), "EC" (Euro), "CLI" (Copa Libertadores)

### get_competition_matches
- `competition` (string, required) — Competition code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FOOTBALL_DATA_API_KEY` | Yes | Football-Data.org API key (same as football-data server) |


## Upstream API

- **Provider**: Football-Data.org
- **Base URL**: https://api.football-data.org/v4
- **Auth**: API key (header: X-Auth-Token)
- **Rate Limits**: 10 req/min (free)
- **Docs**: https://www.football-data.org/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-fifa .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FOOTBALL_DATA_API_KEY=xxx -p 3000:3000 settlegrid-fifa
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
