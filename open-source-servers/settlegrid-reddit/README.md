# settlegrid-reddit

Reddit MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-reddit)

Reddit posts, comments, and subreddit data via public JSON API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_subreddit(subreddit)` | Get hot posts from a subreddit | 1¢ |
| `search(q)` | Search Reddit posts | 1¢ |

## Parameters

### get_subreddit
- `subreddit` (string, required) — Subreddit name (e.g. programming)
- `limit` (number, optional) — Number of posts (default: 20)

### search
- `q` (string, required) — Search query
- `sort` (string, optional) — Sort: relevance, hot, top, new (default: "relevance")
- `limit` (number, optional) — Results limit (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Reddit API.

## Upstream API

- **Provider**: Reddit
- **Base URL**: https://www.reddit.com
- **Auth**: None required
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
