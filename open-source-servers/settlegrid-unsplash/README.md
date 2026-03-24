# settlegrid-unsplash

Unsplash MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-unsplash)

Search free high-quality photos from Unsplash with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + UNSPLASH_ACCESS_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_photos(query, per_page)` | Search Unsplash photos | 2¢ |
| `get_random(query)` | Get a random photo | 2¢ |

## Parameters

### search_photos
- `query` (string, required) — Search query
- `per_page` (number, optional) — Results (1-20, default 10)

### get_random
- `query` (string, optional) — Optional topic filter

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `UNSPLASH_ACCESS_KEY` | Yes | Unsplash Access Key |


## Upstream API

- **Provider**: Unsplash
- **Base URL**: https://api.unsplash.com
- **Auth**: Free API key required
- **Rate Limits**: 50 req/hr
- **Docs**: https://unsplash.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-unsplash .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e UNSPLASH_ACCESS_KEY=xxx -p 3000:3000 settlegrid-unsplash
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
