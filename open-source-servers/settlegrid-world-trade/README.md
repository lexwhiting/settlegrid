# settlegrid-world-trade

WTO Trade Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-world-trade)

Access World Trade Organization trade statistics and indicators via the WTO Timeseries API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_trade_data(reporter, year?)` | Get trade data for a reporter country | 2¢ |
| `list_indicators()` | List available WTO indicators | 1¢ |
| `search_topics(query)` | Search WTO data topics | 1¢ |

## Parameters

### get_trade_data
- `reporter` (string, required) — ISO3 country code (e.g. USA, CHN, DEU)
- `year` (string) — Year (e.g. 2022). Defaults to latest.

### list_indicators

### search_topics
- `query` (string, required) — Search query (e.g. "tariffs", "services")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream WTO Timeseries API API — it is completely free.

## Upstream API

- **Provider**: WTO Timeseries API
- **Base URL**: https://api.wto.org/timeseries/v1
- **Auth**: None required
- **Docs**: https://apiportal.wto.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-world-trade .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-world-trade
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
