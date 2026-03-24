# settlegrid-world-bank-health

World Bank Health Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-world-bank-health)

Access World Bank health indicators including life expectancy, health spending, and mortality data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_life_expectancy(country, year?)` | Get life expectancy data | 2¢ |
| `get_health_spending(country, year?)` | Get health expenditure data | 2¢ |
| `list_indicators()` | List health indicators | 1¢ |

## Parameters

### get_life_expectancy
- `country` (string, required) — ISO country code (e.g. USA, JPN)
- `year` (string) — Year (e.g. 2021)

### get_health_spending
- `country` (string, required) — ISO country code
- `year` (string) — Year

### list_indicators

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
docker build -t settlegrid-world-bank-health .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-world-bank-health
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
