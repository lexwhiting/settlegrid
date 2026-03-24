# settlegrid-rawg

RAWG Video Games MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rawg)

Search and browse video game data from the RAWG database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + RAWG_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_games(query)` | Search video games by name | 2¢ |
| `get_game(id)` | Get game details by ID or slug | 2¢ |

## Parameters

### search_games
- `query` (string, required)

### get_game
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `RAWG_API_KEY` | Yes | Free key from rawg.io/apidocs |


## Upstream API

- **Provider**: RAWG
- **Base URL**: https://api.rawg.io/api
- **Auth**: Free API key required
- **Rate Limits**: 20 req/sec
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
