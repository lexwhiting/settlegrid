# settlegrid-census-historical

Historical Census Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-census-historical)

Access US Census Bureau historical data. Query census datasets, list available surveys, and explore variables.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_data(year, variables, state?)` | Get census data by year and variables | 2¢ |
| `list_datasets()` | List available census datasets | 1¢ |
| `list_variables(dataset)` | List variables for a dataset | 1¢ |

## Parameters

### get_data
- `year` (string, required) — Census year (e.g. "2020", "2010")
- `variables` (string, required) — Comma-separated variable codes (e.g. "NAME,P1_001N")
- `state` (string) — State FIPS code (e.g. "06" for California)

### list_datasets

### list_variables
- `dataset` (string, required) — Dataset path (e.g. "2020/dec/pl")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Census API API — it is completely free.

## Upstream API

- **Provider**: US Census API
- **Base URL**: https://api.census.gov/data
- **Auth**: None required
- **Docs**: https://www.census.gov/data/developers.html

## Deploy

### Docker

```bash
docker build -t settlegrid-census-historical .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-census-historical
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
