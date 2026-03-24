# settlegrid-cloud-pricing

Cloud Provider Pricing MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cloud-pricing)

Compare cloud provider pricing across Azure, AWS, and GCP retail price catalogs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_prices(service?, region?)` | Get cloud service prices (Azure) | 1¢ |
| `compare_services(service)` | Compare pricing for a service type | 2¢ |
| `list_regions()` | List available cloud regions | 1¢ |

## Parameters

### get_prices
- `service` (string) — Service name filter (e.g. Virtual Machines)
- `region` (string) — Azure region (e.g. eastus)

### compare_services
- `service` (string, required) — Service to compare (e.g. Virtual Machines, Storage)

### list_regions

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Azure Retail Prices API — it is completely free.

## Upstream API

- **Provider**: Azure Retail Prices
- **Base URL**: https://prices.azure.com/api/retail/prices
- **Auth**: None required
- **Docs**: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices

## Deploy

### Docker

```bash
docker build -t settlegrid-cloud-pricing .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cloud-pricing
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
