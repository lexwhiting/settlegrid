# settlegrid-igdb

IGDB (Internet Game Database) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-igdb)

Search video games, get details and reviews from IGDB (Twitch-owned).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TWITCH_CLIENT_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_games(query)` | Search video games by name | 2¢ |
| `get_game(game_id)` | Get detailed game info by ID | 2¢ |

## Parameters

### search_games
- `query` (string, required) — Game title to search

### get_game
- `game_id` (number, required) — IGDB game ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TWITCH_CLIENT_ID` | Yes | Twitch Client ID + TWITCH_CLIENT_SECRET for IGDB access |


## Upstream API

- **Provider**: IGDB / Twitch
- **Base URL**: https://api.igdb.com/v4
- **Auth**: Twitch Client ID + Bearer token
- **Rate Limits**: 4 req/sec
- **Docs**: https://api-docs.igdb.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-igdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TWITCH_CLIENT_ID=xxx -p 3000:3000 settlegrid-igdb
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
