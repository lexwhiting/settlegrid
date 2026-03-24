# settlegrid-giphy

Giphy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-giphy)

Search and get trending GIFs and stickers from Giphy

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GIPHY_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(q)` | Search for GIFs | 1¢ |
| `get_trending()` | Get trending GIFs | 1¢ |

## Parameters

### search
- `q` (string, required) — Search query
- `limit` (number, optional) — Results limit (default: 20)

### get_trending
- `limit` (number, optional) — Results limit (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GIPHY_API_KEY` | Yes | Giphy API key from [https://developers.giphy.com/](https://developers.giphy.com/) |

## Upstream API

- **Provider**: Giphy
- **Base URL**: https://api.giphy.com/v1
- **Auth**: API key (query)
- **Docs**: https://developers.giphy.com/docs/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-giphy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GIPHY_API_KEY=xxx -p 3000:3000 settlegrid-giphy
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
