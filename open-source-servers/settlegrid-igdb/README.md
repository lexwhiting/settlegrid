# settlegrid-igdb

IGDB (Internet Game Database) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-igdb)

Search video game data — titles, ratings, platforms via the IGDB API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + IGDB_BEARER_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_games(query)` | Search video games by name | 2¢ |
| `get_game(id)` | Get game details by ID | 2¢ |

## Parameters

### search_games
- `query` (string, required)

### get_game
- `id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `IGDB_BEARER_TOKEN` | Yes | Twitch Client Credentials OAuth token for IGDB |


## Upstream API

- **Provider**: IGDB / Twitch
- **Base URL**: https://api.igdb.com/v4
- **Auth**: Free API key required
- **Rate Limits**: 4 req/sec
- **Docs**: https://api-docs.igdb.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-igdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e IGDB_BEARER_TOKEN=xxx -p 3000:3000 settlegrid-igdb
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
