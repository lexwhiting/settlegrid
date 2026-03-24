# settlegrid-renewable-energy

US EIA Energy Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-renewable-energy)

US Energy Information Administration data on renewable and conventional energy.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + EIA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_electricity(fuel_type)` | Get electricity generation data by source | 2¢ |
| `get_total_energy(series)` | Get total energy production and consumption stats | 2¢ |

## Parameters

### get_electricity
- `fuel_type` (string, optional)

### get_total_energy
- `series` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `EIA_API_KEY` | Yes | Free key from eia.gov |


## Upstream API

- **Provider**: US EIA
- **Base URL**: https://api.eia.gov/v2
- **Auth**: Free API key required
- **Rate Limits**: Reasonable use
- **Docs**: https://www.eia.gov/opendata/documentation.php

## Deploy

### Docker

```bash
docker build -t settlegrid-renewable-energy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e EIA_API_KEY=xxx -p 3000:3000 settlegrid-renewable-energy
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
