# settlegrid-boardgame-atlas

Board Game Atlas MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-boardgame-atlas)

Search board games, mechanics, and categories from Board Game Atlas.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BGA_CLIENT_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_games(query)` | Search board games by name | 2¢ |
| `get_game(id)` | Get board game details by ID | 2¢ |

## Parameters

### search_games
- `query` (string, required)

### get_game
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BGA_CLIENT_ID` | Yes | Free client ID from boardgameatlas.com/api/docs |


## Upstream API

- **Provider**: Board Game Atlas
- **Base URL**: https://api.boardgameatlas.com/api
- **Auth**: Free API key required
- **Rate Limits**: Reasonable use
- **Docs**: https://www.boardgameatlas.com/api/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-boardgame-atlas .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BGA_CLIENT_ID=xxx -p 3000:3000 settlegrid-boardgame-atlas
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
