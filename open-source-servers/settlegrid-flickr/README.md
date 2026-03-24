# settlegrid-flickr

Flickr Photo Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search and explore Flickr photos. Requires free Flickr API key.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_photos(query, page?, perPage?)` | Search Flickr photos | 1¢ |
| `get_photo_info(photoId)` | Get photo details | 1¢ |
| `get_interesting()` | Today's interesting photos | 1¢ |

## Parameters

### search_photos
- `query` (string, required) — Search query
- `page` (number) — Page number (default 1)
- `perPage` (number) — Results per page (1-50, default 20)

### get_photo_info
- `photoId` (string, required) — Flickr photo ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-flickr .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-flickr
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
