# settlegrid-diffbot

Diffbot MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-diffbot)

Automatically classify web pages and extract structured data using Diffbot's AI-powered Analyze API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `analyze_url(url: string, mode?: string, fallback?: string, fields?: string, discussion?: boolean, timeout?: number)` | Classify and extract structured data from any web page URL | 5¢ |

## Parameters

### analyze_url
- `url` (string, required) — The URL of the web page to analyze and extract data from
- `mode` (string) — Force extraction type (e.g. article, product, discussion, image, video, list, event)
- `fallback` (string) — Force non-matched pages to be processed by a specific API type
- `fields` (string) — Comma-separated list of optional fields to include in the response
- `discussion` (boolean) — Set to false to disable automatic extraction of comments or reviews (default: true)
- `timeout` (number) — Timeout in milliseconds for the upstream request (max 60000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `DIFFBOT_API_KEY` | Yes | Diffbot API key from [https://app.diffbot.com/get-started/](https://app.diffbot.com/get-started/) |

## Upstream API

- **Provider**: Diffbot
- **Base URL**: https://api.diffbot.com
- **Auth**: API key required
- **Docs**: https://docs.diffbot.com/reference/extract-analyze

## Deploy

### Docker

```bash
docker build -t settlegrid-diffbot .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-diffbot
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
