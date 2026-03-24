# settlegrid-pixabay-images

Pixabay Images MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pixabay-images)

Free stock photos and videos search from Pixabay.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_images(query, limit?)` | Search Pixabay images | 2¢ |
| `search_videos(query, limit?)` | Search Pixabay videos | 2¢ |

## Parameters

### search_images
- `query` (string, required) — Search term
- `limit` (number) — Max results (default 20)

### search_videos
- `query` (string, required) — Search term
- `limit` (number) — Max results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PIXABAY_API_KEY` | Yes | Pixabay API key from [https://pixabay.com/api/docs/](https://pixabay.com/api/docs/) |

## Upstream API

- **Provider**: Pixabay
- **Base URL**: https://pixabay.com/api
- **Auth**: API key required
- **Docs**: https://pixabay.com/api/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-pixabay-images .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pixabay-images
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
