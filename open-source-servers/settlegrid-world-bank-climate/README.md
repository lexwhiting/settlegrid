# settlegrid-world-bank-climate

World Bank Climate Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-world-bank-climate)

Access World Bank climate-related indicators including CO2 emissions, renewable energy, and forest data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_climate_data(country, indicator)` | Get climate indicator data for a country | 2¢ |
| `list_indicators()` | List climate-related indicators | 1¢ |
| `get_historical(country, variable)` | Get historical climate variable for a country | 2¢ |

## Parameters

### get_climate_data
- `country` (string, required) — ISO3 or ISO2 country code (e.g. USA, GB)
- `indicator` (string, required) — WB indicator code (e.g. EN.ATM.CO2E.PC for CO2 per capita)

### list_indicators

### get_historical
- `country` (string, required) — ISO3 country code
- `variable` (string, required) — Climate variable (e.g. EN.ATM.CO2E.KT, AG.LND.FRST.ZS)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API API — it is completely free.

## Upstream API

- **Provider**: World Bank API
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392

## Deploy

### Docker

```bash
docker build -t settlegrid-world-bank-climate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-world-bank-climate
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
