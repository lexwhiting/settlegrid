# settlegrid-census-data

US Census Bureau MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-census-data)

US Census Bureau population, economic, and demographic data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_acs_data(year, variables, state)` | American Community Survey data | 2¢ |
| `get_population(year)` | State population estimates | 2¢ |
| `get_datasets()` | List available Census datasets | 1¢ |

## Parameters

### get_acs_data
- `year` (string, required) — Survey year (e.g. "2022")
- `variables` (string, required) — Comma-separated variable names (e.g. "B01001_001E" for population)
- `state` (string) — State FIPS code (e.g. "06" for California)

### get_population
- `year` (string, required) — Year (e.g. "2022")

### get_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CENSUS_API_KEY` | Yes | US Census Bureau API key from [https://api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html) |

## Upstream API

- **Provider**: US Census Bureau
- **Base URL**: https://api.census.gov/data
- **Auth**: API key required
- **Docs**: https://www.census.gov/data/developers.html

## Deploy

### Docker

```bash
docker build -t settlegrid-census-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-census-data
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
