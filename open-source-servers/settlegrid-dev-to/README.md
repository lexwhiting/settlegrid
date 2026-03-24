# settlegrid-dev-to

DEV.to MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dev-to)

DEV.to community articles, users, and tags

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_articles()` | Get published articles | 1¢ |
| `get_article(id)` | Get article by ID | 1¢ |

## Parameters

### get_articles
- `tag` (string, optional) — Filter by tag
- `per_page` (number, optional) — Results per page (default: 20)

### get_article
- `id` (number, required) — Article ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DEV.to API.

## Upstream API

- **Provider**: DEV.to
- **Base URL**: https://dev.to/api
- **Auth**: None required
- **Docs**: https://developers.forem.com/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-dev-to .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dev-to
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
