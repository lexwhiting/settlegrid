# settlegrid-nba-stats

NBA Stats MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nba-stats)

NBA player stats, teams, and game data from BallDontLie.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_players(query)` | Search NBA players by name | 1¢ |
| `get_teams()` | List all NBA teams | 1¢ |
| `get_games(date)` | Get NBA games by date | 1¢ |

## Parameters

### search_players
- `query` (string, required) — Player name

### get_games
- `date` (string, required) — Date in YYYY-MM-DD format

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: BallDontLie
- **Base URL**: https://api.balldontlie.io/v1
- **Auth**: None required
- **Rate Limits**: 30 req/min
- **Docs**: https://www.balldontlie.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-nba-stats .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nba-stats
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
