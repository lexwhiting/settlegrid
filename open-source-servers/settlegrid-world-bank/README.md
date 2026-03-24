# settlegrid-world-bank

World Bank Development Indicators MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-world-bank)

Access GDP, poverty, health, education, and thousands of development indicators for 300+ economies. Powered by the World Bank Open Data API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicator(country, indicator)` | Fetch indicator time series data | 2¢ |
| `search_indicators(query)` | Search available indicators | 1¢ |
| `get_countries()` | List available countries/economies | 1¢ |

## Popular Indicator Codes

| Code | Description |
|------|-------------|
| `NY.GDP.MKTP.CD` | GDP (current USD) |
| `NY.GDP.PCAP.CD` | GDP per capita (current USD) |
| `SP.POP.TOTL` | Total population |
| `SI.POV.DDAY` | Poverty headcount ratio |
| `SP.DYN.LE00.IN` | Life expectancy at birth |
| `SE.ADT.LITR.ZS` | Adult literacy rate |
| `SL.UEM.TOTL.ZS` | Unemployment rate |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API.

## Upstream API

- **Provider**: World Bank Group
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
