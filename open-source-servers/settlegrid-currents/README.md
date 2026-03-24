# settlegrid-currents

Currents API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-currents)

Latest news and current events from around the world.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CURRENTS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_news(keywords, language)` | Search current news by keyword | 2¢ |
| `latest_news(language)` | Get latest news articles | 2¢ |

## Parameters

### search_news
- `keywords` (string, required)
- `language` (string, optional)

### latest_news
- `language` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CURRENTS_API_KEY` | Yes | Free key from currentsapi.services |


## Upstream API

- **Provider**: Currents API
- **Base URL**: https://api.currentsapi.services/v1
- **Auth**: Free API key required
- **Rate Limits**: 600 req/day (free)
- **Docs**: https://currentsapi.services/en/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-currents .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CURRENTS_API_KEY=xxx -p 3000:3000 settlegrid-currents
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
