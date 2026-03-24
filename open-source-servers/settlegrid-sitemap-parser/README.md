# settlegrid-sitemap-parser

Sitemap Parser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sitemap-parser)

Parse, analyze, and discover sitemap XML files.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_sitemap(url)` | Parse sitemap | 1¢ |
| `get_sitemap_stats(url)` | Get statistics | 1¢ |
| `discover_sitemaps(domain)` | Discover sitemaps | 1¢ |

## Parameters

### get_sitemap
- `url` (string, required) — Sitemap URL
- `limit` (number, optional) — Max URLs to return (default 50, max 200)
### get_sitemap_stats
- `url` (string, required) — Sitemap URL
### discover_sitemaps
- `domain` (string, required) — Domain to scan

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Direct fetch
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-sitemap-parser .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sitemap-parser
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
