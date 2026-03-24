# settlegrid-pixabay

Pixabay MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pixabay)

Search free images and videos from Pixabay with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PIXABAY_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_images(query, per_page)` | Search Pixabay images | 2¢ |
| `search_videos(query, per_page)` | Search Pixabay videos | 2¢ |

## Parameters

### search_images
- `query` (string, required) — Search query
- `per_page` (number, optional) — Results (3-20, default 10)

### search_videos
- `query` (string, required) — Search query
- `per_page` (number, optional) — Results (3-20, default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PIXABAY_API_KEY` | Yes | Pixabay API key |


## Upstream API

- **Provider**: Pixabay
- **Base URL**: https://pixabay.com/api
- **Auth**: Free API key required
- **Rate Limits**: 100 req/min
- **Docs**: https://pixabay.com/api/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-pixabay .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PIXABAY_API_KEY=xxx -p 3000:3000 settlegrid-pixabay
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
