# settlegrid-emoji-data

Emoji Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-emoji-data)

Emoji search and info from Open Emoji API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_emoji(query)` | Search emojis by keyword | 1¢ |

## Parameters

### search_emoji
- `query` (string, required) — Search keyword

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `EMOJI_API_KEY` | Yes | Open Emoji API API key from [https://emoji-api.com/](https://emoji-api.com/) |

## Upstream API

- **Provider**: Open Emoji API
- **Base URL**: https://emoji-api.com
- **Auth**: API key required
- **Docs**: https://emoji-api.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-emoji-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-emoji-data
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
