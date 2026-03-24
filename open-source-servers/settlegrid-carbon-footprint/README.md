# settlegrid-carbon-footprint

Carbon Interface MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-carbon-footprint)

Carbon footprint estimation for vehicles, flights, electricity, and shipping.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CARBON_INTERFACE_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `estimate_vehicle(distance_value, distance_unit)` | Estimate CO2 emissions for a vehicle trip by distance | 2¢ |
| `estimate_electricity(electricity_value, country)` | Estimate CO2 for electricity usage by kWh and country | 2¢ |

## Parameters

### estimate_vehicle
- `distance_value` (number, required)
- `distance_unit` (string, required)

### estimate_electricity
- `electricity_value` (number, required)
- `country` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CARBON_INTERFACE_KEY` | Yes | Free key from carboninterface.com |


## Upstream API

- **Provider**: Carbon Interface
- **Base URL**: https://www.carboninterface.com/api/v1
- **Auth**: Free API key required
- **Rate Limits**: 200 req/mo (free)
- **Docs**: https://docs.carboninterface.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-carbon-footprint .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CARBON_INTERFACE_KEY=xxx -p 3000:3000 settlegrid-carbon-footprint
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
