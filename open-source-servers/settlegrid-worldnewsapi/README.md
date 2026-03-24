# settlegrid-worldnewsapi

World News API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-worldnewsapi)

Search world news articles by keyword, language, or country.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WORLDNEWS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_news(text, language)` | Search news articles by keyword | 2¢ |
| `get_top_news(source_country)` | Get top news by country | 2¢ |

## Parameters

### search_news
- `text` (string, required)
- `language` (string, optional)

### get_top_news
- `source_country` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WORLDNEWS_API_KEY` | Yes | Free key from worldnewsapi.com |


## Upstream API

- **Provider**: World News API
- **Base URL**: https://api.worldnewsapi.com
- **Auth**: Free API key required
- **Rate Limits**: 50 req/day (free)
- **Docs**: https://worldnewsapi.com/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-worldnewsapi .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WORLDNEWS_API_KEY=xxx -p 3000:3000 settlegrid-worldnewsapi
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
