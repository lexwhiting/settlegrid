# settlegrid-metropolitan

Met Museum Collection MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-metropolitan)

Search and retrieve artwork data from The Metropolitan Museum of Art open-access collection API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_artworks(query, limit?)` | Search Met artworks by keyword | 1¢ |
| `get_artwork(objectID)` | Get artwork details by object ID | 1¢ |
| `get_departments()` | List all Met Museum departments | 1¢ |

## Parameters

### search_artworks
- `query` (string, required) — Search query term
- `limit` (number) — Max results (default 10)

### get_artwork
- `objectID` (number, required) — Met Museum object ID

### get_departments

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Met Museum Open Access API API — it is completely free.

## Upstream API

- **Provider**: Met Museum Open Access API
- **Base URL**: https://collectionapi.metmuseum.org/public/collection/v1
- **Auth**: None required
- **Docs**: https://metmuseum.github.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-metropolitan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-metropolitan
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
