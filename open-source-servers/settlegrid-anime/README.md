# settlegrid-anime

Anime & Manga (Jikan) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-anime)

Search anime, manga, and character data via the Jikan/MyAnimeList API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_anime(query)` | Search anime by title | 1¢ |
| `search_manga(query)` | Search manga by title | 1¢ |
| `get_top_anime(type)` | Get top-rated anime | 1¢ |

## Parameters

### search_anime
- `query` (string, required) — Anime title

### search_manga
- `query` (string, required) — Manga title

### get_top_anime
- `type` (string, optional) — "tv", "movie", "ova", "special" (default: all)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Jikan (MyAnimeList)
- **Base URL**: https://api.jikan.moe/v4
- **Auth**: None required
- **Rate Limits**: 3 req/sec
- **Docs**: https://docs.api.jikan.moe/

## Deploy

### Docker

```bash
docker build -t settlegrid-anime .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-anime
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
