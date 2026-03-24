# settlegrid-pixabay

Pixabay MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pixabay)

Free stock photos, illustrations, and vectors from Pixabay

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PIXABAY_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(q)` | Search for images | 1¢ |

## Parameters

### search
- `q` (string, required) — Search query
- `image_type` (string, optional) — Type: all, photo, illustration, vector (default: "all")
- `per_page` (number, optional) — Results per page (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PIXABAY_API_KEY` | Yes | Pixabay API key from [https://pixabay.com/api/docs/](https://pixabay.com/api/docs/) |

## Upstream API

- **Provider**: Pixabay
- **Base URL**: https://pixabay.com/api
- **Auth**: API key (query)
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
