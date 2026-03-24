# settlegrid-omdb

OMDb (Open Movie Database) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-omdb)

Search and retrieve movie data from the Open Movie Database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OMDB_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_movies(query)` | Search movies by title | 2¢ |
| `get_movie(query)` | Get movie details by IMDb ID or title | 2¢ |

## Parameters

### search_movies
- `query` (string, required)

### get_movie
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OMDB_API_KEY` | Yes | Free key from omdbapi.com (1000 req/day) |


## Upstream API

- **Provider**: OMDb
- **Base URL**: https://www.omdbapi.com
- **Auth**: Free API key required
- **Rate Limits**: 1000 req/day (free)
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
