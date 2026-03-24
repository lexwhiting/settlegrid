# settlegrid-azure-pricing

Azure Service Pricing MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-azure-pricing)

Azure retail pricing data — VMs, storage, databases, networking, and all Azure services.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_prices(service?, region?)` | Get Azure service prices with filters | 1¢ |
| `search_skus(query)` | Search Azure SKUs by keyword | 1¢ |
| `list_services()` | List available Azure services | 1¢ |

## Parameters

### get_prices
- `service` (string) — Service name (e.g. Virtual Machines, Storage)
- `region` (string) — Azure region (e.g. eastus, westeurope)

### search_skus
- `query` (string, required) — Search keyword (e.g. D2s, Standard_B)

### list_services

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
docker build -t settlegrid-azure-pricing .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-azure-pricing
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
