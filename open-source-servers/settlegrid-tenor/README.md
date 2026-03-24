# settlegrid-tenor

Tenor MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tenor)

Search GIFs and stickers from Google Tenor API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TENOR_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_gifs(query, limit)` | Search for GIFs | 2¢ |
| `get_featured(limit)` | Get featured/trending GIFs | 2¢ |

## Parameters

### search_gifs
- `query` (string, required) — Search query
- `limit` (number, optional) — Max results (1-20, default 10)

### get_featured
- `limit` (number, optional) — Max results (1-20, default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TENOR_API_KEY` | Yes | Tenor / Google API key |


## Upstream API

- **Provider**: Google (Tenor)
- **Base URL**: https://tenor.googleapis.com/v2
- **Auth**: Free API key required
- **Rate Limits**: Varies by key
- **Docs**: https://developers.google.com/tenor/guides/quickstart

## Deploy

### Docker

```bash
docker build -t settlegrid-tenor .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TENOR_API_KEY=xxx -p 3000:3000 settlegrid-tenor
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
