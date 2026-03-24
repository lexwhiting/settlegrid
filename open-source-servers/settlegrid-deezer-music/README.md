# settlegrid-deezer-music

Deezer Music MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-deezer-music)

Music search, track info, and chart data from Deezer public API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_tracks(query, limit?)` | Search for music tracks | 1¢ |
| `get_chart()` | Get current music charts | 1¢ |
| `get_artist_info(artist_id)` | Get artist info by ID | 1¢ |

## Parameters

### search_tracks
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 20)

### get_chart

### get_artist_info
- `artist_id` (number, required) — Deezer artist ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Deezer API — it is completely free.

## Upstream API

- **Provider**: Deezer
- **Base URL**: https://api.deezer.com
- **Auth**: None required
- **Docs**: https://developers.deezer.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-deezer-music .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-deezer-music
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
