# settlegrid-india-data

India Open Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-india-data)

Indian government open data from data.gov.in

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + INDIA_DATA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_resource(resourceId)` | Get data from a specific resource | 1¢ |

## Parameters

### get_resource
- `resourceId` (string, required) — Resource ID from data.gov.in
- `limit` (number, optional) — Results limit (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `INDIA_DATA_API_KEY` | Yes | India Open Data API key from [https://data.gov.in/](https://data.gov.in/) |

## Upstream API

- **Provider**: India Open Data
- **Base URL**: https://api.data.gov.in/resource
- **Auth**: API key (query)
- **Docs**: https://data.gov.in/help/apis

## Deploy

### Docker

```bash
docker build -t settlegrid-india-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e INDIA_DATA_API_KEY=xxx -p 3000:3000 settlegrid-india-data
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
