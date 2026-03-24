# settlegrid-reddit

Reddit MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-reddit)

Fetch Reddit posts, comments, and subreddit data via public JSON API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_subreddit(subreddit, limit)` | Get hot posts from a subreddit | 1¢ |
| `search_posts(query, subreddit)` | Search Reddit posts | 1¢ |

## Parameters

### get_subreddit
- `subreddit` (string, required) — Subreddit name (without r/)
- `limit` (number, optional) — Max posts (1-25, default 10)

### search_posts
- `query` (string, required) — Search query
- `subreddit` (string, optional) — Limit to subreddit

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Reddit
- **Base URL**: https://www.reddit.com
- **Auth**: None required
- **Rate Limits**: 10 req/min unauthenticated
- **Docs**: https://www.reddit.com/dev/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-reddit .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-reddit
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
