# settlegrid-steam-data

Steam Game Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-steam-data)

Steam game details, pricing, player counts, and top games.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_game_details(app_id)` | Get game details | 1¢ |
| `search_games(query)` | Search games | 1¢ |
| `get_top_games(limit)` | Get top games | 1¢ |

## Parameters

### get_game_details
- `app_id` (string, required) — Steam app ID
### search_games
- `query` (string, required) — Search term
### get_top_games
- `limit` (number, optional) — Results (default 20, max 100)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Steam Store API + SteamSpy
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-steam-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-steam-data
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
