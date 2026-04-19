# settlegrid-scrapingbee

ScrapingBee MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-scrapingbee)

Scrape any webpage's HTML content with proxy rotation and optional JavaScript rendering via the ScrapingBee API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `scrape_url(url: string, render_js?: boolean, block_resources?: boolean, country_code?: string, wait?: number)` | Scrape a webpage and return its HTML content | 3¢ |
| `scrape_with_extraction(url: string, extract_rules: string, render_js?: boolean, wait_for?: string)` | Scrape a webpage and extract specific data using CSS rules | 5¢ |
| `scrape_with_premium_proxy(url: string, render_js?: boolean, country_code?: string, device?: string)` | Scrape a webpage using premium proxies to bypass tough anti-bot measures | 7¢ |

## Parameters

### scrape_url
- `url` (string, required) — The full URL of the webpage to scrape
- `render_js` (boolean) — Enable JavaScript rendering via headless browser (default false)
- `block_resources` (boolean) — Block images and CSS resources to speed up the request (default false)
- `country_code` (string) — Two-letter country code for proxy geolocation (e.g. us, gb, de)
- `wait` (number) — Milliseconds to wait before returning the response (max 35000)

### scrape_with_extraction
- `url` (string, required) — The full URL of the webpage to scrape
- `extract_rules` (string, required) — JSON string of extraction rules mapping keys to CSS selectors (e.g. {"title":"h1","links":"a@href"})
- `render_js` (boolean) — Enable JavaScript rendering via headless browser (default false)
- `wait_for` (string) — CSS selector to wait for before returning the response

### scrape_with_premium_proxy
- `url` (string, required) — The full URL of the webpage to scrape
- `render_js` (boolean) — Enable JavaScript rendering via headless browser (default false)
- `country_code` (string) — Two-letter country code for proxy geolocation (e.g. us, gb, de)
- `device` (string) — Device type to emulate: 'desktop' or 'mobile' (default desktop)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SCRAPINGBEE_API_KEY` | Yes | ScrapingBee API key from [https://app.scrapingbee.com/account/register](https://app.scrapingbee.com/account/register) |

## Upstream API

- **Provider**: ScrapingBee
- **Base URL**: https://app.scrapingbee.com/api/v1
- **Auth**: API key required
- **Docs**: https://www.scrapingbee.com/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-scrapingbee .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-scrapingbee
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
