# settlegrid-hackernews-top

Hacker News Top Stories MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hackernews-top)

Top and best stories from Hacker News Firebase API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_top_stories(limit?)` | Get top HN stories | 1¢ |

## Parameters

### get_top_stories
- `limit` (number) — Max stories (default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream HN Firebase API — it is completely free.

## Upstream API

- **Provider**: HN Firebase
- **Base URL**: https://hacker-news.firebaseio.com/v0
- **Auth**: None required
- **Docs**: https://github.com/HackerNews/API

## Deploy

### Docker

```bash
docker build -t settlegrid-hackernews-top .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hackernews-top
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
