# settlegrid-musicbrainz

MusicBrainz MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-musicbrainz)

Search artists, releases, and recordings via the MusicBrainz open music encyclopedia.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_artists(query)` | Search for music artists | 1¢ |
| `search_releases(query)` | Search for album/single releases | 1¢ |
| `get_artist(mbid)` | Get artist details by MBID | 1¢ |

## Parameters

### search_artists
- `query` (string, required) — Artist name to search

### search_releases
- `query` (string, required) — Release title to search

### get_artist
- `mbid` (string, required) — MusicBrainz artist ID (UUID)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: MusicBrainz
- **Base URL**: https://musicbrainz.org/ws/2
- **Auth**: None required
- **Rate Limits**: 1 req/sec
- **Docs**: https://musicbrainz.org/doc/MusicBrainz_API

## Deploy

### Docker

```bash
docker build -t settlegrid-musicbrainz .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-musicbrainz
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
