# settlegrid-tvmaze

TVMaze MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tvmaze)

Search TV shows, get episode guides, and schedule data from TVMaze.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_shows(query)` | Search TV shows by name | 1¢ |
| `get_episodes(show_id)` | Get episode list for a show | 1¢ |
| `get_schedule(country, date)` | Get TV schedule for a date/country | 1¢ |

## Parameters

### search_shows
- `query` (string, required) — Show name to search for

### get_episodes
- `show_id` (number, required) — TVMaze show ID

### get_schedule
- `country` (string, optional) — ISO country code (default: "US")
- `date` (string, optional) — Date in YYYY-MM-DD format

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: TVMaze
- **Base URL**: https://api.tvmaze.com
- **Auth**: None required
- **Rate Limits**: 20 req/10s
- **Docs**: https://www.tvmaze.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-tvmaze .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tvmaze
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
