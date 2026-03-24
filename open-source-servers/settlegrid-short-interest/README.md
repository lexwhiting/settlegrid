# settlegrid-short-interest

Short Interest Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-short-interest)

Short selling interest and volume data via FINRA. Track short positions and threshold securities.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_short_interest(symbol)` | Get short interest for symbol | 1¢ |
| `get_volume(symbol, days?)` | Get short volume data | 1¢ |
| `get_threshold_list()` | Get Reg SHO threshold list | 1¢ |

## Parameters

### get_short_interest
- `symbol` (string, required) — Stock ticker symbol

### get_volume
- `symbol` (string, required) — Stock ticker symbol
- `days` (number) — Number of days of data (default: 5)

### get_threshold_list

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream FINRA API — it is completely free.

## Upstream API

- **Provider**: FINRA
- **Base URL**: https://api.finra.org/data/group/otcMarket
- **Auth**: None required
- **Docs**: https://developer.finra.org/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-short-interest .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-short-interest
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
