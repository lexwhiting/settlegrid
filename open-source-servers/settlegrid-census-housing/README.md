# settlegrid-census-housing

Census Housing Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-census-housing)

Detailed housing statistics from the American Community Survey.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CENSUS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_housing_values(state)` | Get median home values by state | 2¢ |
| `get_housing_by_county(state)` | Get housing data for all counties in a state | 2¢ |

## Parameters

### get_housing_values
- `state` (string, required)

### get_housing_by_county
- `state` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CENSUS_API_KEY` | Yes | Free key from api.census.gov/data/key_signup.html |


## Upstream API

- **Provider**: US Census Bureau
- **Base URL**: https://api.census.gov/data
- **Auth**: Free API key required
- **Rate Limits**: 500 req/day
- **Docs**: https://www.census.gov/data/developers/data-sets/acs-1year.html

## Deploy

### Docker

```bash
docker build -t settlegrid-census-housing .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CENSUS_API_KEY=xxx -p 3000:3000 settlegrid-census-housing
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
