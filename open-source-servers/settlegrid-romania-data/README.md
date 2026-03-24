# settlegrid-romania-data

Romania National Institute of Statistics (INS) open data MCP Server with SettleGrid billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-romania-data)

Romania National Institute of Statistics (INS) open data MCP Server with SettleGrid billing

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_demographics(region)` | Get Romania population and regional data | 2¢ |
| `get_economy(indicator)` | Get economic indicators | 2¢ |

## Parameters

### get_demographics
- `region` (string, optional) — County name (bucharest, cluj, timis, iasi, constanta, brasov)

### get_economy
- `indicator` (string, required) — Economic indicator (gdp, gdp_growth, unemployment, inflation, min_wage, exports)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: Romania National Institute of Statistics (INS)
- **Docs**: https://insse.ro/cms/en

## Deploy

### Docker

```bash
docker build -t settlegrid-romania-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-romania-data
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
