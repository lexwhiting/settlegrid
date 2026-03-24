# settlegrid-mediastack

Mediastack MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mediastack)

Real-time and historical news articles from 7,500+ sources.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + MEDIASTACK_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_news(keywords, languages)` | Search news articles by keyword | 2¢ |
| `get_sources(countries)` | List available news sources | 2¢ |

## Parameters

### search_news
- `keywords` (string, required)
- `languages` (string, optional)

### get_sources
- `countries` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `MEDIASTACK_KEY` | Yes | Free key from mediastack.com |


## Upstream API

- **Provider**: Mediastack
- **Base URL**: https://api.mediastack.com/v1
- **Auth**: Free API key required
- **Rate Limits**: 500 req/month (free)
- **Docs**: https://mediastack.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-mediastack .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e MEDIASTACK_KEY=xxx -p 3000:3000 settlegrid-mediastack
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
