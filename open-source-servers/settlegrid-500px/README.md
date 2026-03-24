# settlegrid-500px

500px Photos MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search and explore popular photos on 500px. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_500px_photos(query, limit?)` | Search photos | 1¢ |
| `get_popular_photos(feature?, limit?)` | Popular/trending photos | 1¢ |

## Parameters

### search_500px_photos
- `query` (string, required) — Search query
- `limit` (number) — Results limit (1-50, default 20)

### get_popular_photos
- `feature` (string) — popular, upcoming, editors, fresh_today
- `limit` (number) — Results limit (1-50, default 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-500px .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-500px
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
