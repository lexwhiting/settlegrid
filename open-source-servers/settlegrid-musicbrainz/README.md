# settlegrid-musicbrainz

MusicBrainz MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-musicbrainz)

Music metadata — artists, albums, recordings from MusicBrainz.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_artist(query, limit?)` | Search for music artists | 1¢ |
| `search_release(query, limit?)` | Search for album releases | 1¢ |
| `get_artist_releases(artist_id)` | Get releases by artist ID | 1¢ |

## Parameters

### search_artist
- `query` (string, required) — Artist name to search
- `limit` (number) — Max results (default 10)

### search_release
- `query` (string, required) — Album title to search
- `limit` (number) — Max results

### get_artist_releases
- `artist_id` (string, required) — MusicBrainz artist ID (UUID)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream MusicBrainz API — it is completely free.

## Upstream API

- **Provider**: MusicBrainz
- **Base URL**: https://musicbrainz.org/ws/2
- **Auth**: None required
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
