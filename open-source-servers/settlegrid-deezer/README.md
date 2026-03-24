# settlegrid-deezer

Deezer Music MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search artists, albums, and tracks on Deezer. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_tracks(query, limit?)` | Search tracks | 1¢ |
| `get_artist(id)` | Get artist info | 1¢ |
| `get_album(id)` | Get album info with tracks | 1¢ |
| `get_chart()` | Get current chart | 1¢ |

## Parameters

### search_tracks
- `query` (string, required) — Search query
- `limit` (number) — Results limit (1-50, default 25)

### get_artist / get_album
- `id` (number, required) — Deezer ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-deezer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-deezer
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
