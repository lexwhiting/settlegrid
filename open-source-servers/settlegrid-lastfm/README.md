# settlegrid-lastfm

Last.fm Music MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lastfm)

Music scrobble data, artist info, and top charts from Last.fm.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_top_artists(limit?)` | Get top artists globally | 2¢ |
| `get_artist_info_lastfm(artist)` | Get detailed artist info | 2¢ |

## Parameters

### get_top_artists
- `limit` (number) — Max results (default 20)

### get_artist_info_lastfm
- `artist` (string, required) — Artist name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LASTFM_API_KEY` | Yes | Last.fm API key from [https://www.last.fm/api/account/create](https://www.last.fm/api/account/create) |

## Upstream API

- **Provider**: Last.fm
- **Base URL**: https://ws.audioscrobbler.com/2.0
- **Auth**: API key required
- **Docs**: https://www.last.fm/api

## Deploy

### Docker

```bash
docker build -t settlegrid-lastfm .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lastfm
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
