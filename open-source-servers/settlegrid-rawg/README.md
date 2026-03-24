# settlegrid-rawg

RAWG Video Games Database MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rawg)

Search and explore 500,000+ video games from the RAWG database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + RAWG_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_games(query)` | Search video games | 2¢ |
| `get_game(id)` | Get game details by slug or ID | 2¢ |
| `get_genres()` | List all game genres | 1¢ |

## Parameters

### search_games
- `query` (string, required) — Game title to search

### get_game
- `id` (string, required) — Game ID or slug

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `RAWG_API_KEY` | Yes | RAWG API key (free at rawg.io) |


## Upstream API

- **Provider**: RAWG
- **Base URL**: https://api.rawg.io/api
- **Auth**: API key (query param)
- **Rate Limits**: 20,000/mo free
- **Docs**: https://rawg.io/apidocs

## Deploy

### Docker

```bash
docker build -t settlegrid-rawg .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e RAWG_API_KEY=xxx -p 3000:3000 settlegrid-rawg
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
