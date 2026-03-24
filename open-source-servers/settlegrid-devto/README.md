# settlegrid-devto

DEV.to MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-devto)

Search and read DEV.to developer articles with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + DEVTO_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_articles(tag, per_page)` | Get latest or top articles | 1¢ |
| `search_articles(query, per_page)` | Search DEV.to articles | 1¢ |

## Parameters

### get_articles
- `tag` (string, optional) — Filter by tag
- `per_page` (number, optional) — Results (1-20, default 10)

### search_articles
- `query` (string, required) — Search query
- `per_page` (number, optional) — Results (1-20, default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `DEVTO_API_KEY` | Yes | DEV.to API key (optional for public reads) |


## Upstream API

- **Provider**: DEV.to
- **Base URL**: https://dev.to/api
- **Auth**: Free API key optional
- **Rate Limits**: 30 req/30s
- **Docs**: https://developers.forem.com/api/v1

## Deploy

### Docker

```bash
docker build -t settlegrid-devto .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e DEVTO_API_KEY=xxx -p 3000:3000 settlegrid-devto
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
