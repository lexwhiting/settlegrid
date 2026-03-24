# settlegrid-unsplash

Unsplash MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-unsplash)

Free high-resolution photos and image search from Unsplash

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + UNSPLASH_ACCESS_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(query)` | Search for photos | 1¢ |
| `get_random()` | Get a random photo | 1¢ |

## Parameters

### search
- `query` (string, required) — Search query
- `per_page` (number, optional) — Results per page (default: 20)

### get_random
- `query` (string, optional) — Topic filter

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `UNSPLASH_ACCESS_KEY` | Yes | Unsplash API key from [https://unsplash.com/developers](https://unsplash.com/developers) |

## Upstream API

- **Provider**: Unsplash
- **Base URL**: https://api.unsplash.com
- **Auth**: API key (header)
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
