# settlegrid-thesportsdb

TheSportsDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-thesportsdb)

Multi-sport data: teams, players, events, and leagues from TheSportsDB.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_teams(query)` | Search teams by name | 1¢ |
| `search_players(query)` | Search players by name | 1¢ |
| `get_events(team_id, type)` | Get last/next events for a team | 1¢ |

## Parameters

### search_teams
- `query` (string, required) — Team name

### search_players
- `query` (string, required) — Player name

### get_events
- `team_id` (string, required) — Team ID
- `type` (string, optional) — "last" or "next" (default: "next")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: TheSportsDB
- **Base URL**: https://www.thesportsdb.com/api/v1/json/3
- **Auth**: None required
- **Rate Limits**: Reasonable use
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
