# settlegrid-pexels

Pexels MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pexels)

Free stock photos and videos from Pexels

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PEXELS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_photos(query)` | Search for photos | 1¢ |
| `get_curated()` | Get curated photos | 1¢ |

## Parameters

### search_photos
- `query` (string, required) — Search query
- `per_page` (number, optional) — Results per page (default: 20)

### get_curated
- `per_page` (number, optional) — Results per page (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PEXELS_API_KEY` | Yes | Pexels API key from [https://www.pexels.com/api/](https://www.pexels.com/api/) |

## Upstream API

- **Provider**: Pexels
- **Base URL**: https://api.pexels.com/v1
- **Auth**: API key (header)
- **Docs**: https://www.pexels.com/api/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-pexels .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PEXELS_API_KEY=xxx -p 3000:3000 settlegrid-pexels
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
