# settlegrid-rijksmuseum

Rijksmuseum Collection MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rijksmuseum)

Search and explore Dutch masterworks from the Rijksmuseum collection via their public API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_artworks(query, limit?)` | Search Rijksmuseum artworks | 1¢ |
| `get_artwork(objectNumber)` | Get artwork by object number | 1¢ |
| `get_collections(limit?)` | Browse recent collection items | 1¢ |

## Parameters

### search_artworks
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_artwork
- `objectNumber` (string, required) — Rijksmuseum object number (e.g. SK-C-5)

### get_collections
- `limit` (number) — Max results (default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `RIJKS_API_KEY` | Yes | Rijksmuseum API API key from [https://data.rijksmuseum.nl](https://data.rijksmuseum.nl) |

## Upstream API

- **Provider**: Rijksmuseum API
- **Base URL**: https://www.rijksmuseum.nl/api/en/collection
- **Auth**: API key required
- **Docs**: https://data.rijksmuseum.nl/object-metadata/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-rijksmuseum .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-rijksmuseum
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
