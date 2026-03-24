# settlegrid-rss-parser

RSS Parser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rss-parser)

Fetch and parse any RSS/Atom feed into structured data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse_feed(url)` | Fetch and parse an RSS/Atom feed URL | 1¢ |
| `get_headlines(url, limit)` | Get headlines from an RSS feed URL | 1¢ |

## Parameters

### parse_feed
- `url` (string, required)

### get_headlines
- `url` (string, required)
- `limit` (number, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Local XML Parser
- **Base URL**: 
- **Auth**: None required
- **Rate Limits**: N/A (local parsing)
- **Docs**: 

## Deploy

### Docker

```bash
docker build -t settlegrid-rss-parser .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-rss-parser
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
