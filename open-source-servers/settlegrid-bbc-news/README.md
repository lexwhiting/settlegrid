# settlegrid-bbc-news

BBC News MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bbc-news)

Latest BBC News headlines parsed from RSS feed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_headlines()` | Get latest BBC News headlines | 1¢ |
| `get_section(section)` | Get BBC News headlines by section (world, business, technology, etc.) | 1¢ |

## Parameters

### get_section
- `section` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: BBC
- **Base URL**: https://feeds.bbci.co.uk/news/rss.xml
- **Auth**: None required
- **Rate Limits**: Public RSS feed
- **Docs**: https://www.bbc.co.uk/news/10628494

## Deploy

### Docker

```bash
docker build -t settlegrid-bbc-news .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bbc-news
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
