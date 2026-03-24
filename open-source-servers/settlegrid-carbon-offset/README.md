# settlegrid-carbon-offset

Carbon Offset MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-carbon-offset)

Carbon footprint calculations and offset cost estimates.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `estimate_flight(from, to)` | Estimate flight carbon footprint | 2¢ |
| `estimate_vehicle(distance_km)` | Estimate vehicle emissions | 1¢ |
| `estimate_electricity(kwh)` | Estimate electricity emissions | 1¢ |

## Parameters

### estimate_flight
- `from` (string, required) — Departure IATA code
- `to` (string, required) — Arrival IATA code
- `passengers` (number, optional) — Passenger count (default 1)
### estimate_vehicle
- `distance_km` (number, required) — Distance in kilometers
- `model` (string, optional) — Vehicle model ID
### estimate_electricity
- `kwh` (number, required) — Electricity in kilowatt-hours
- `country` (string, optional) — Country code (default us)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CARBON_INTERFACE_KEY` | Yes | Free key from carboninterface.com |

## Upstream API

- **Provider**: Carbon Interface
- **Base URL**: https://www.carboninterface.com/api/v1
- **Auth**: Free API key required
- **Docs**: https://docs.carboninterface.com/

## Deploy

### Docker
```bash
docker build -t settlegrid-carbon-offset .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-carbon-offset
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
