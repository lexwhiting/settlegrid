# settlegrid-reddit-news

Reddit News MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-reddit-news)

Get top news posts from Reddit r/news and r/worldnews.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_news(sort)` | Get top posts from r/news | 1¢ |
| `get_worldnews(sort)` | Get top posts from r/worldnews | 1¢ |
| `search_subreddit(subreddit, q)` | Search posts in a subreddit | 1¢ |

## Parameters

### get_news
- `sort` (string, optional)

### get_worldnews
- `sort` (string, optional)

### search_subreddit
- `subreddit` (string, required)
- `q` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Reddit
- **Base URL**: https://www.reddit.com
- **Auth**: None required
- **Rate Limits**: Public JSON API
- **Docs**: https://www.reddit.com/dev/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-reddit-news .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-reddit-news
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
