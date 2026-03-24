# settlegrid-pexels-photos

Pexels Photos MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pexels-photos)

Free stock photos search from Pexels API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_pexels(query, limit?)` | Search Pexels photos | 2¢ |
| `get_curated(limit?)` | Get curated photos | 2¢ |

## Parameters

### search_pexels
- `query` (string, required) — Search term
- `limit` (number) — Max results (default 15)

### get_curated
- `limit` (number) — Max results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PEXELS_API_KEY` | Yes | Pexels API key from [https://www.pexels.com/api/](https://www.pexels.com/api/) |

## Upstream API

- **Provider**: Pexels
- **Base URL**: https://api.pexels.com/v1
- **Auth**: API key required
- **Docs**: https://www.pexels.com/api/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-pexels-photos .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pexels-photos
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
