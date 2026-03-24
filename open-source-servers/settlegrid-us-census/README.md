# settlegrid-us-census

US Census MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-us-census)

US Census Bureau population, demographics, and economic data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CENSUS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_population(get, for)` | Get population data by state | 2¢ |
| `list_datasets()` | List available Census datasets | 1¢ |

## Parameters

### get_population
- `get` (string, required) — Variables (e.g. B01003_001E for population)
- `for` (string, required) — Geography (e.g. state:* for all states)

### list_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CENSUS_API_KEY` | Yes | US Census API key from [https://api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html) |

## Upstream API

- **Provider**: US Census
- **Base URL**: https://api.census.gov/data
- **Auth**: API key (query)
- **Docs**: https://www.census.gov/data/developers/data-sets.html

## Deploy

### Docker

```bash
docker build -t settlegrid-us-census .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CENSUS_API_KEY=xxx -p 3000:3000 settlegrid-us-census
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
