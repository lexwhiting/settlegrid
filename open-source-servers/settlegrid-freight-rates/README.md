# settlegrid-freight-rates

Freight Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-freight-rates)

Container and air freight pricing with FBX index data.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_container_rate(origin, dest)` | Container rate | 2¢ |
| `get_fbx_index()` | Freightos Baltic Index | 1¢ |
| `get_air_freight_rate(origin, dest)` | Air freight rate | 2¢ |

## Parameters

### get_container_rate
- `origin` (string, required) — Origin port code
- `destination` (string, required) — Destination port code
- `container_type` (string, optional) — 20ft or 40ft
### get_air_freight_rate
- `origin` (string, required) — Origin airport code
- `destination` (string, required) — Destination airport code
- `weight_kg` (number, optional) — Weight in kg

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Freightos Baltic Index + estimates
- **Auth**: None required for index data

## Deploy

### Docker
```bash
docker build -t settlegrid-freight-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-freight-rates
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
