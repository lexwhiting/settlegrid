# settlegrid-gnews

GNews MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gnews)

Search Google News articles by keyword, topic, or country.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GNEWS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_news(q, lang)` | Search news articles by keyword | 2¢ |
| `top_headlines(topic, country)` | Get top headlines by topic or country | 2¢ |

## Parameters

### search_news
- `q` (string, required)
- `lang` (string, optional)

### top_headlines
- `topic` (string, optional)
- `country` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GNEWS_API_KEY` | Yes | Free key from gnews.io |


## Upstream API

- **Provider**: GNews
- **Base URL**: https://gnews.io/api/v4
- **Auth**: Free API key required
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://gnews.io/docs/v4

## Deploy

### Docker

```bash
docker build -t settlegrid-gnews .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GNEWS_API_KEY=xxx -p 3000:3000 settlegrid-gnews
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
