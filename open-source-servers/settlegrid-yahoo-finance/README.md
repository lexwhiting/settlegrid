# settlegrid-yahoo-finance

Yahoo Finance MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-yahoo-finance)

Stock quotes, charts, and market data via Yahoo Finance query API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_chart(symbol)` | Get price chart data for a ticker | 2¢ |

## Parameters

### get_chart
- `symbol` (string, required) — Stock ticker (e.g. AAPL)
- `range` (string, optional) — Time range: 1d,5d,1mo,3mo,6mo,1y,5y,max (default: "1mo")
- `interval` (string, optional) — Data interval: 1m,5m,1h,1d,1wk (default: "1d")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Yahoo Finance API.

## Upstream API

- **Provider**: Yahoo Finance
- **Base URL**: https://query1.finance.yahoo.com/v8/finance
- **Auth**: None required
- **Docs**: https://finance.yahoo.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-yahoo-finance .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-yahoo-finance
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
