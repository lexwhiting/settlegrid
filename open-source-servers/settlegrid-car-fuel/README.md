# settlegrid-car-fuel

Fuel Economy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-car-fuel)

EPA fuel economy data for vehicles from fueleconomy.gov.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_years()` | Get list of available model years | 1¢ |
| `get_makes(year)` | Get vehicle makes for a given year | 1¢ |
| `get_vehicle(id)` | Get fuel economy details for a vehicle by ID | 1¢ |

## Parameters

### get_makes
- `year` (number, required)

### get_vehicle
- `id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: EPA / fueleconomy.gov
- **Base URL**: https://www.fueleconomy.gov/ws/rest
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://www.fueleconomy.gov/feg/ws/

## Deploy

### Docker

```bash
docker build -t settlegrid-car-fuel .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-car-fuel
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
