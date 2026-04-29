# settlegrid-browserless

Browserless MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-browserless)

Capture screenshots, generate PDFs, scrape page content, and extract structured data from web pages using the Browserless headless browser REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `take_screenshot(url: string, fullPage?: boolean, width?: number, height?: number)` | Capture a screenshot of a web page | 5¢ |
| `get_page_content(url: string, waitFor?: number)` | Retrieve the rendered HTML content of a web page | 3¢ |
| `scrape_page(url: string, elements: Array<{ selector: string, timeout?: number }>)` | Scrape structured data from a web page using CSS selectors | 4¢ |
| `smart_scrape_page(url: string, prompt: string)` | Intelligently extract content from a web page using AI-powered scraping | 6¢ |

## Parameters

### take_screenshot
- `url` (string, required) — The URL of the page to screenshot
- `fullPage` (boolean) — Capture the full scrollable page (default: false)
- `width` (number) — Viewport width in pixels (default: 1920, max: 3840)
- `height` (number) — Viewport height in pixels (default: 1080, max: 2160)

### get_page_content
- `url` (string, required) — The URL of the page to retrieve content from
- `waitFor` (number) — Milliseconds to wait after page load before capturing (default: 0, max: 10000)

### scrape_page
- `url` (string, required) — The URL of the page to scrape
- `elements` (array, required) — Array of objects with a 'selector' (CSS selector string) and optional 'timeout' (ms) for each element to scrape

### smart_scrape_page
- `url` (string, required) — The URL of the page to smart-scrape
- `prompt` (string, required) — Natural language description of what data to extract from the page

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BROWSERLESS_API_KEY` | Yes | Browserless API key from [https://www.browserless.io/signup/email?plan=free](https://www.browserless.io/signup/email?plan=free) |

## Upstream API

- **Provider**: Browserless
- **Base URL**: https://production-sfo.browserless.io
- **Auth**: API key required
- **Docs**: https://docs.browserless.io/rest-apis/intro

## Deploy

### Docker

```bash
docker build -t settlegrid-browserless .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-browserless
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
