# settlegrid-nyt

New York Times MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nyt)

Search NYT articles, top stories, and book reviews.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NYT_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_articles(q)` | Search NYT articles by keyword | 2¢ |
| `top_stories(section)` | Get top stories by section | 2¢ |

## Parameters

### search_articles
- `q` (string, required)

### top_stories
- `section` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NYT_API_KEY` | Yes | Free key from developer.nytimes.com |


## Upstream API

- **Provider**: The New York Times
- **Base URL**: https://api.nytimes.com/svc
- **Auth**: Free API key required
- **Rate Limits**: 10 req/min (free)
- **Docs**: https://developer.nytimes.com/apis

## Deploy

### Docker

```bash
docker build -t settlegrid-nyt .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NYT_API_KEY=xxx -p 3000:3000 settlegrid-nyt
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
