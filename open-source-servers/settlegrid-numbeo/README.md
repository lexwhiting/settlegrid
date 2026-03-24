# settlegrid-numbeo

Numbeo MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-numbeo)

Cost of living, property prices, and quality of life indices worldwide.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_cost_of_living(city)` | Cost of living index by city | 1¢ |
| `get_indices(country)` | Quality of life indices by country | 1¢ |
| `get_city_prices(city)` | Item prices in a city | 1¢ |

## Parameters

### get_cost_of_living
- `city` (string, required) — City name (e.g. "New York")

### get_indices
- `country` (string, required) — Country name (e.g. "United States")

### get_city_prices
- `city` (string, required) — City name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Numbeo API — it is completely free.

## Upstream API

- **Provider**: Numbeo
- **Base URL**: https://www.numbeo.com/api
- **Auth**: None required
- **Docs**: https://www.numbeo.com/common/api.jsp

## Deploy

### Docker

```bash
docker build -t settlegrid-numbeo .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-numbeo
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
