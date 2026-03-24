# settlegrid-migration-data

Migration Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-migration-data)

Access migration and remittance data via World Bank API. Get migration stocks, remittance flows, and browse indicators.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_migration(country, year?)` | Get migration data for a country | 1¢ |
| `get_remittances(country, year?)` | Get remittance data for a country | 2¢ |
| `list_indicators()` | List migration-related indicators | 1¢ |

## Parameters

### get_migration
- `country` (string, required) — ISO2 country code (e.g. US, MX, DE)
- `year` (string) — Year (e.g. "2020"). Defaults to latest.

### get_remittances
- `country` (string, required) — ISO2 country code
- `year` (string) — Year (e.g. "2020")

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
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-migration-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-migration-data
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
