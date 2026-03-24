# settlegrid-short-url

URL Shortening MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-short-url)

Shorten and expand URLs using the free is.gd service.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `shorten(url)` | Create a short URL | 1¢ |
| `expand(shortUrl)` | Expand a short URL to original | 1¢ |

## Parameters

### shorten
- `url` (string, required) — Long URL to shorten

### expand
- `shortUrl` (string, required) — Short URL to expand

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: is.gd
- **Base URL**: https://is.gd
- **Auth**: None required
- **Docs**: https://is.gd/apishorteningguide.php

## Deploy

### Docker

```bash
docker build -t settlegrid-short-url .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-short-url
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
