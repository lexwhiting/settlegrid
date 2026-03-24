# settlegrid-openapc

OpenAPC Publication Costs MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openapc)

Access article processing charge (APC) data, institutional spending, and open access costs via the OpenAPC OLAP API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_costs(institution?, year?)` | Get APC costs by institution/year | 1¢ |
| `list_institutions()` | List institutions with APC data | 1¢ |
| `get_stats(year?)` | Get APC spending statistics | 1¢ |

## Parameters

### get_costs
- `institution` (string) — Institution name to filter
- `year` (number) — Publication year to filter

### list_institutions

### get_stats
- `year` (number) — Year to filter statistics

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenAPC API — it is completely free.

## Upstream API

- **Provider**: OpenAPC
- **Base URL**: https://olap.openapc.net/cube/openapc/aggregate
- **Auth**: None required
- **Docs**: https://github.com/OpenAPC/openapc-de/wiki/OLAP-API

## Deploy

### Docker

```bash
docker build -t settlegrid-openapc .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openapc
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
