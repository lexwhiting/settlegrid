# settlegrid-url-shortener

URL Shortener MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-url-shortener)

Shorten long URLs using the is.gd service.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `shorten_url(url)` | Create a shortened URL | 1¢ |
| `shorten_custom(url, shorturl)` | Create a shortened URL with custom shorturl path (via v.gd) | 1¢ |

## Parameters

### shorten_url
- `url` (string, required)

### shorten_custom
- `url` (string, required)
- `shorturl` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: is.gd
- **Base URL**: https://is.gd
- **Auth**: None required
- **Rate Limits**: Reasonable use (no key)
- **Docs**: https://is.gd/developers.php

## Deploy

### Docker

```bash
docker build -t settlegrid-url-shortener .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-url-shortener
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
