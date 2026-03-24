# settlegrid-imf-data

IMF Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-imf-data)

IMF economic indicators, country data, and World Economic Outlook.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicators()` | List available IMF indicators | 1¢ |
| `get_indicator_data(indicator, country)` | Data for a specific indicator | 1¢ |
| `get_countries()` | List countries with codes | 1¢ |

## Parameters

### get_indicators

### get_indicator_data
- `indicator` (string, required) — Indicator code (e.g. NGDP_RPCH for real GDP growth)
- `country` (string) — ISO country code (e.g. USA)

### get_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream IMF DataMapper API — it is completely free.

## Upstream API

- **Provider**: IMF DataMapper
- **Base URL**: https://www.imf.org/external/datamapper/api/v1
- **Auth**: None required
- **Docs**: https://www.imf.org/external/datamapper/api/v1

## Deploy

### Docker

```bash
docker build -t settlegrid-imf-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-imf-data
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
