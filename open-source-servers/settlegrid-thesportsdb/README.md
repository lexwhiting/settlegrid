# settlegrid-thesportsdb

TheSportsDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-thesportsdb)

Multi-sport data — teams, players, events across all major sports.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_teams(query)` | Search sports teams by name | 1¢ |
| `search_players(query)` | Search players by name | 1¢ |
| `get_events(league_id, round)` | Get past events for a league by round | 1¢ |

## Parameters

### search_teams
- `query` (string, required)

### search_players
- `query` (string, required)

### get_events
- `league_id` (string, required)
- `round` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: TheSportsDB
- **Base URL**: https://www.thesportsdb.com
- **Auth**: None required
- **Rate Limits**: 30 req/min (free)
- **Docs**: https://www.thesportsdb.com/api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-thesportsdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-thesportsdb
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
