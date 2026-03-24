# settlegrid-country-data

REST Countries MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-country-data)

Detailed data on 250+ countries and territories. Population, languages, currencies, borders, coordinates, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_country(name)` | Full details for a country by name | 1¢ |
| `search(query)` | Search countries by partial name | 1¢ |
| `get_by_region(region)` | List all countries in a region | 1¢ |

## Parameters

### get_country
- `name` (string, required) — Country name (e.g. "France", "United States")

### search
- `query` (string, required) — Partial name to search (e.g. "united", "island")

### get_by_region
- `region` (string, required) — One of: Africa, Americas, Asia, Europe, Oceania

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream REST Countries API.

## Upstream API

- **Provider**: REST Countries
- **Base URL**: https://restcountries.com/v3.1
- **Auth**: None required
- **Docs**: https://restcountries.com/

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
