# settlegrid-un-population

UN Population Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-un-population)

Access United Nations population estimates and projections via the UN Data Portal API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_population(country, year?)` | Get population data for a country | 2¢ |
| `list_indicators()` | List available population indicators | 1¢ |
| `list_locations()` | List available locations/countries | 1¢ |

## Parameters

### get_population
- `country` (string, required) — ISO3166 numeric country code or name (e.g. 840 for USA)
- `year` (string) — Year (e.g. 2023). Defaults to latest.

### list_indicators

### list_locations

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UN Population Data Portal API — it is completely free.

## Upstream API

- **Provider**: UN Population Data Portal
- **Base URL**: https://population.un.org/dataportalapi/api/v1
- **Auth**: None required
- **Docs**: https://population.un.org/dataportal/about/dataapi

## Deploy

### Docker

```bash
docker build -t settlegrid-un-population .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-un-population
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
