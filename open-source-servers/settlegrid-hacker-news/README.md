# settlegrid-hacker-news

Hacker News MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hacker-news)

Hacker News top stories, comments, and user data via Firebase API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_top_stories()` | Get IDs of current top stories | 1¢ |
| `get_item(id)` | Get a story, comment, or poll by ID | 1¢ |
| `get_user(username)` | Get user profile | 1¢ |

## Parameters

### get_top_stories

### get_item
- `id` (number, required) — Item ID

### get_user
- `username` (string, required) — HN username

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Hacker News API.

## Upstream API

- **Provider**: Hacker News
- **Base URL**: https://hacker-news.firebaseio.com/v0
- **Auth**: None required
- **Docs**: https://github.com/HackerNews/API

## Deploy

### Docker

```bash
docker build -t settlegrid-hacker-news .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hacker-news
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
