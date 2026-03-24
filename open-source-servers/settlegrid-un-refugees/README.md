# settlegrid-un-refugees

UNHCR Refugee Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-un-refugees)

Access UNHCR refugee statistics and population data via the UNHCR Population API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_refugee_data(country, year?)` | Get refugee data for a country | 2¢ |
| `list_countries()` | List countries with refugee data | 1¢ |
| `get_demographics(country)` | Get demographic breakdown for a country | 2¢ |

## Parameters

### get_refugee_data
- `country` (string, required) — ISO3 country code (e.g. SYR, AFG, UKR)
- `year` (string) — Year (e.g. 2023). Defaults to latest.

### list_countries

### get_demographics
- `country` (string, required) — ISO3 country code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UNHCR Population API API — it is completely free.

## Upstream API

- **Provider**: UNHCR Population API
- **Base URL**: https://api.unhcr.org/population/v1
- **Auth**: None required
- **Docs**: https://api.unhcr.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-un-refugees .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-un-refugees
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
