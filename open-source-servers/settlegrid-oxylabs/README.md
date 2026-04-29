# settlegrid-oxylabs

Oxylabs Web Scraper MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-oxylabs)

Scrape any URL in realtime using Oxylabs' proxy infrastructure with optional JavaScript rendering, geo-targeting, and structured parsing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `scrape_url(url: string, render?: string, geo_location?: string, parse?: boolean)` | Scrape any URL using Oxylabs universal source | 5¢ |
| `scrape_google_search(query: string, geo_location?: string, parse?: boolean)` | Scrape Google Search results for a query | 5¢ |
| `scrape_amazon_product(url: string, geo_location?: string, parse?: boolean)` | Scrape an Amazon product page by ASIN or URL | 5¢ |
| `scrape_with_js(url: string, geo_location?: string, parse?: boolean)` | Scrape a JavaScript-heavy URL with full browser rendering | 7¢ |

## Parameters

### scrape_url
- `url` (string, required) — The full URL to scrape (e.g. https://example.com)
- `render` (string) — Enable JavaScript rendering by setting to 'html'
- `geo_location` (string) — Geographic location for the request (e.g. 'United States', 'Germany')
- `parse` (boolean) — Whether to return parsed structured results instead of raw HTML

### scrape_google_search
- `query` (string, required) — Search query to look up on Google
- `geo_location` (string) — Geographic location for localized search results (e.g. 'United States')
- `parse` (boolean) — Whether to return parsed structured results instead of raw HTML

### scrape_amazon_product
- `url` (string, required) — Amazon product URL to scrape
- `geo_location` (string) — Geographic location for localized Amazon pricing (e.g. 'United States')
- `parse` (boolean) — Whether to return parsed structured product data

### scrape_with_js
- `url` (string, required) — The full URL to scrape with JavaScript rendering enabled
- `geo_location` (string) — Geographic location for the request (e.g. 'United States')
- `parse` (boolean) — Whether to return parsed structured results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OXYLABS_CREDENTIALS` | Yes | Oxylabs API key from [https://oxylabs.io/products/scraper-api](https://oxylabs.io/products/scraper-api) |

## Upstream API

- **Provider**: Oxylabs
- **Base URL**: https://realtime.oxylabs.io
- **Auth**: API key required
- **Docs**: https://developers.oxylabs.io

## Deploy

### Docker

```bash
docker build -t settlegrid-oxylabs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-oxylabs
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
