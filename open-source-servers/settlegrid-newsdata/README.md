# settlegrid-newsdata

Newsdata.io MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-newsdata)

News articles by country, category, and language.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NEWSDATA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_news(q, country)` | Search news by keyword and country | 2¢ |
| `latest_news(country, category)` | Get latest news by country | 2¢ |

## Parameters

### search_news
- `q` (string, required)
- `country` (string, optional)

### latest_news
- `country` (string, optional)
- `category` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NEWSDATA_API_KEY` | Yes | Free key from newsdata.io |


## Upstream API

- **Provider**: Newsdata.io
- **Base URL**: https://newsdata.io/api/1
- **Auth**: Free API key required
- **Rate Limits**: 200 req/day (free)
- **Docs**: https://newsdata.io/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-newsdata .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NEWSDATA_API_KEY=xxx -p 3000:3000 settlegrid-newsdata
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
