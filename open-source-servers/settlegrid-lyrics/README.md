# settlegrid-lyrics

Song Lyrics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search and retrieve song lyrics via lyrics.ovh. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_lyrics(artist, title)` | Get lyrics for a specific song | 1¢ |
| `search_lyrics(query)` | Search for songs | 1¢ |

## Parameters

### get_lyrics
- `artist` (string, required) — Artist name
- `title` (string, required) — Song title

### search_lyrics
- `query` (string, required) — Search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-lyrics .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lyrics
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
