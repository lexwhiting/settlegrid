# settlegrid-cdn-data

CDN Performance Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cdn-data)

CDN traffic analytics, performance statistics, and trends via Cloudflare Radar.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_traffic(domain?)` | Get internet traffic data | 1¢ |
| `get_stats(country?)` | Get internet statistics by country | 1¢ |
| `get_trends(days?)` | Get internet traffic trends | 2¢ |

## Parameters

### get_traffic
- `domain` (string) — Domain to check (omit for global stats)

### get_stats
- `country` (string) — ISO country code (e.g. US)

### get_trends
- `days` (number) — Number of days to look back (default 7)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Cloudflare Radar API — it is completely free.

## Upstream API

- **Provider**: Cloudflare Radar
- **Base URL**: https://radar.cloudflare.com/api
- **Auth**: None required
- **Docs**: https://developers.cloudflare.com/radar/

## Deploy

### Docker

```bash
docker build -t settlegrid-cdn-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cdn-data
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
