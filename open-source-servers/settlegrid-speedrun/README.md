# settlegrid-speedrun

Speedrun.com MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-speedrun)

Speedrun leaderboards, world records, and game categories.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_games(query)` | Search games | 1¢ |
| `get_leaderboard(game_id, category_id)` | Get leaderboard | 1¢ |
| `get_record(game_id)` | Get world record | 1¢ |

## Parameters

### search_games
- `query` (string, required) — Game name
### get_leaderboard
- `game_id` (string, required) — Speedrun.com game ID
- `category_id` (string, required) — Category ID
### get_record
- `game_id` (string, required) — Game ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Speedrun.com
- **Auth**: None required
- **Docs**: https://github.com/speedruncomorg/api

## Deploy

### Docker
```bash
docker build -t settlegrid-speedrun .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-speedrun
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
