# settlegrid-gcp-pricing

GCP Service Pricing MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gcp-pricing)

Google Cloud Platform pricing data — compute, storage, networking, and managed services.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_compute_prices(region?)` | Get GCP Compute Engine pricing | 2¢ |
| `list_services()` | List GCP services with billing info | 1¢ |
| `get_skus(service)` | Get SKU pricing for a GCP service | 2¢ |

## Parameters

### get_compute_prices
- `region` (string) — GCP region (e.g. us-central1)

### list_services

### get_skus
- `service` (string, required) — GCP service ID or name (e.g. Compute Engine)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream GCP Cloud Billing API — it is completely free.

## Upstream API

- **Provider**: GCP Cloud Billing
- **Base URL**: https://cloudbilling.googleapis.com/v1
- **Auth**: None required
- **Docs**: https://cloud.google.com/billing/docs/reference/rest

## Deploy

### Docker

```bash
docker build -t settlegrid-gcp-pricing .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-gcp-pricing
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
