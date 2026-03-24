# settlegrid-newsapi

NewsAPI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-newsapi)

Search news articles from 80,000+ sources worldwide via NewsAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NEWSAPI_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_articles(q, language)` | Search news articles by keyword | 2¢ |
| `top_headlines(country, category)` | Get top headlines by country or category | 2¢ |
| `get_sources(language)` | List available news sources | 2¢ |

## Parameters

### search_articles
- `q` (string, required)
- `language` (string, optional)

### top_headlines
- `country` (string, optional)
- `category` (string, optional)

### get_sources
- `language` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NEWSAPI_KEY` | Yes | Free key from newsapi.org |


## Upstream API

- **Provider**: NewsAPI
- **Base URL**: https://newsapi.org/v2
- **Auth**: Free API key required
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://newsapi.org/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-newsapi .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NEWSAPI_KEY=xxx -p 3000:3000 settlegrid-newsapi
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
