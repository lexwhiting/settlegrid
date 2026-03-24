# settlegrid-tmdb

TMDB (The Movie Database) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tmdb)

Search movies, TV shows, and people via The Movie Database API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TMDB_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_movies(query)` | Search movies by title | 2¢ |
| `get_movie(id)` | Get movie details by ID | 2¢ |
| `search_tv(query)` | Search TV shows by name | 2¢ |

## Parameters

### search_movies
- `query` (string, required)

### get_movie
- `id` (number, required)

### search_tv
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TMDB_API_KEY` | Yes | Free key from themoviedb.org |


## Upstream API

- **Provider**: TMDB
- **Base URL**: https://api.themoviedb.org/3
- **Auth**: Free API key required
- **Rate Limits**: ~40 req/10s
- **Docs**: https://developer.themoviedb.org/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-tmdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TMDB_API_KEY=xxx -p 3000:3000 settlegrid-tmdb
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
