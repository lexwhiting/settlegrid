# settlegrid-bls-stats

BLS Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bls-stats)

US Bureau of Labor Statistics data including employment, CPI, and wages

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_series(seriesId)` | Get time series data by series ID | 2¢ |

## Parameters

### get_series
- `seriesId` (string, required) — BLS series ID (e.g. LNS14000000 for unemployment)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream BLS Statistics API.

## Upstream API

- **Provider**: BLS Statistics
- **Base URL**: https://api.bls.gov/publicAPI/v2
- **Auth**: None required
- **Docs**: https://www.bls.gov/developers/

## Deploy

### Docker

```bash
docker build -t settlegrid-bls-stats .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bls-stats
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
