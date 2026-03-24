# settlegrid-art-institute

Art Institute of Chicago MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-art-institute)

Search and explore artworks and artists from the Art Institute of Chicago open API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_artworks(query, limit?)` | Search Art Institute artworks | 1¢ |
| `get_artwork(id)` | Get artwork by ID | 1¢ |
| `get_artists(query?)` | Search or list artists | 1¢ |

## Parameters

### search_artworks
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_artwork
- `id` (number, required) — Art Institute artwork ID

### get_artists
- `query` (string) — Artist name search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Art Institute of Chicago API API — it is completely free.

## Upstream API

- **Provider**: Art Institute of Chicago API
- **Base URL**: https://api.artic.edu/api/v1
- **Auth**: None required
- **Docs**: https://api.artic.edu/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-art-institute .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-art-institute
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
