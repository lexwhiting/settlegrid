# settlegrid-omdb

OMDb (Open Movie Database) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-omdb)

Search and retrieve detailed movie and TV show information from OMDb.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OMDB_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_title(query, type)` | Search movies/shows by title | 2¢ |
| `get_by_id(imdb_id)` | Get detailed info by IMDb ID | 2¢ |

## Parameters

### search_title
- `query` (string, required) — Title to search for
- `type` (string, optional) — "movie", "series", or "episode"

### get_by_id
- `imdb_id` (string, required) — IMDb ID (e.g. "tt1375666")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OMDB_API_KEY` | Yes | OMDb API key (free at omdbapi.com) |


## Upstream API

- **Provider**: OMDb
- **Base URL**: https://www.omdbapi.com
- **Auth**: API key (query param)
- **Rate Limits**: 1000/day (free tier)
- **Docs**: https://www.omdbapi.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-omdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OMDB_API_KEY=xxx -p 3000:3000 settlegrid-omdb
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
