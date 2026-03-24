# settlegrid-rest-countries-v2

REST Countries Extended MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rest-countries-v2)

Extended country data including currencies, borders, timezones, and demographics via REST Countries API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_country(code)` | Get comprehensive country data by code | 1¢ |
| `search_countries(name)` | Search countries by name | 1¢ |
| `get_by_region(region)` | Get all countries in a region | 1¢ |

## Parameters

### get_country
- `code` (string, required) — ISO 3166-1 alpha-2 code (e.g. "US", "DE")

### search_countries
- `name` (string, required) — Country name to search

### get_by_region
- `region` (string, required) — Region name (Africa, Americas, Asia, Europe, Oceania)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: REST Countries
- **Base URL**: https://restcountries.com/v3.1
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://restcountries.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-rest-countries-v2 .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-rest-countries-v2
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
