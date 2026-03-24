# settlegrid-internet-speed

Internet Speed Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-internet-speed)

Global internet speed statistics and rankings from M-Lab speed test data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_stats(country?)` | Get internet speed statistics by country | 1¢ |
| `get_rankings(limit?)` | Get global internet speed rankings | 1¢ |
| `get_history(country?, months?)` | Get historical speed data for a country | 2¢ |

## Parameters

### get_stats
- `country` (string) — ISO country code (e.g. US, GB)

### get_rankings
- `limit` (number) — Number of results (default 20)

### get_history
- `country` (string) — ISO country code
- `months` (number) — Number of months of history (default 12)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream M-Lab Speed Test API — it is completely free.

## Upstream API

- **Provider**: M-Lab Speed Test
- **Base URL**: https://speed.measurementlab.net
- **Auth**: None required
- **Docs**: https://www.measurementlab.net/data/

## Deploy

### Docker

```bash
docker build -t settlegrid-internet-speed .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-internet-speed
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
