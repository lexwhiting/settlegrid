# settlegrid-artsy

Artsy Art & Gallery MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-artsy)

Search artworks, artists, and galleries via the Artsy API with OAuth authentication.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_artworks(query, limit?)` | Search artworks on Artsy | 2¢ |
| `get_artwork(id)` | Get artwork by Artsy ID | 1¢ |
| `search_artists(query)` | Search artists on Artsy | 2¢ |

## Parameters

### search_artworks
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_artwork
- `id` (string, required) — Artsy artwork ID

### search_artists
- `query` (string, required) — Artist name search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ARTSY_CLIENT_ID` | Yes | Artsy API API key from [https://developers.artsy.net](https://developers.artsy.net) |

## Upstream API

- **Provider**: Artsy API
- **Base URL**: https://api.artsy.net/api
- **Auth**: API key required
- **Docs**: https://developers.artsy.net/v2/

## Deploy

### Docker

```bash
docker build -t settlegrid-artsy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-artsy
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
