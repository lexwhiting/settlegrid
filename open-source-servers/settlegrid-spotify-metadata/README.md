# settlegrid-spotify-metadata

Spotify Metadata MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-spotify-metadata)

Search tracks, albums, and artists via the Spotify Web API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + SPOTIFY_ACCESS_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_tracks(query)` | Search for tracks by name | 2¢ |
| `search_artists(query)` | Search for artists by name | 2¢ |
| `get_track(id)` | Get track details by Spotify ID | 2¢ |

## Parameters

### search_tracks
- `query` (string, required)

### search_artists
- `query` (string, required)

### get_track
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SPOTIFY_ACCESS_TOKEN` | Yes | Spotify OAuth token from developer.spotify.com |


## Upstream API

- **Provider**: Spotify
- **Base URL**: https://api.spotify.com/v1
- **Auth**: Free API key required
- **Rate Limits**: Rate-limited per app
- **Docs**: https://developer.spotify.com/documentation/web-api

## Deploy

### Docker

```bash
docker build -t settlegrid-spotify-metadata .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e SPOTIFY_ACCESS_TOKEN=xxx -p 3000:3000 settlegrid-spotify-metadata
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
