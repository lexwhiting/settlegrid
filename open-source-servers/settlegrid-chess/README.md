# settlegrid-chess

Chess Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-chess)

Chess player profiles, games, and stats from Chess.com and Lichess.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_player(username)` | Get Chess.com player profile and stats | 1¢ |
| `get_player_games(username)` | Get recent games for a Chess.com player | 1¢ |
| `get_lichess_player(username)` | Get Lichess player profile | 1¢ |

## Parameters

### get_player
- `username` (string, required) — Chess.com username

### get_player_games
- `username` (string, required) — Chess.com username

### get_lichess_player
- `username` (string, required) — Lichess username

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Chess.com + Lichess
- **Base URL**: https://api.chess.com/pub
- **Auth**: None required
- **Rate Limits**: 100 req/min
- **Docs**: https://www.chess.com/news/view/published-data-api

## Deploy

### Docker

```bash
docker build -t settlegrid-chess .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-chess
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
