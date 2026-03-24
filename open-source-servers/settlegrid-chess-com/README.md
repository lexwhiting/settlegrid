# settlegrid-chess-com

Chess.com MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-chess-com)

Chess.com player stats, game archives, and titled player listings.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_player_stats(username)` | Get player stats | 1¢ |
| `get_player_games(username)` | Get recent games | 1¢ |
| `get_titled_players(title)` | Get titled players | 1¢ |

## Parameters

### get_player_stats / get_player_games
- `username` (string, required) — Chess.com username
### get_titled_players
- `title` (string, required) — Title code (GM, IM, FM, CM, WGM)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Chess.com Published Data API
- **Auth**: None required
- **Docs**: https://www.chess.com/news/view/published-data-api

## Deploy

### Docker
```bash
docker build -t settlegrid-chess-com .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-chess-com
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
