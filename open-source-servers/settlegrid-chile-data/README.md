# settlegrid-chile-data

Chilean Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-chile-data)

Access Chilean economic and development indicators via World Bank API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicators(indicator, per_page?)` | Get indicator data for Chilean Data | 1¢ |
| `list_indicators(topic?, per_page?)` | List available World Bank indicators | 1¢ |
| `get_gdp_data(year?, per_page?)` | Get GDP data for Chile | 1¢ |

## Parameters

### get_indicators
- `indicator` (string, required) — World Bank indicator code (e.g. NY.GDP.MKTP.CD)
- `per_page` (number) — Results per page

### list_indicators
- `topic` (string) — Topic ID to filter indicators
- `per_page` (number) — Results per page

### get_gdp_data
- `year` (string) — Year or date range (e.g. 2020 or 2015:2020)
- `per_page` (number) — Results per page

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API (CHL) API — it is completely free.

## Upstream API

- **Provider**: World Bank API (CHL)
- **Base URL**: https://api.worldbank.org/v2/country/CHL
- **Auth**: None required
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api

## Deploy

### Docker

```bash
docker build -t settlegrid-chile-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-chile-data
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
