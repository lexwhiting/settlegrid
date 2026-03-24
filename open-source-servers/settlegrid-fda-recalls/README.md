# settlegrid-fda-recalls

FDA Recalls MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fda-recalls)

Search FDA food, drug, and device recalls and enforcement actions via openFDA.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_food_recalls(query, limit)` | Search FDA food recall enforcement actions | 1¢ |
| `search_drug_recalls(query, limit)` | Search FDA drug recall enforcement actions | 1¢ |
| `search_device_recalls(query, limit)` | Search FDA medical device recall enforcement actions | 1¢ |

## Parameters

### search_food_recalls
- `query` (string, required) — Search query (product name, company, reason)
- `limit` (number, optional) — Max results 1-100 (default 10)

### search_drug_recalls
- `query` (string, required) — Search query
- `limit` (number, optional) — Max results 1-100 (default 10)

### search_device_recalls
- `query` (string, required) — Search query
- `limit` (number, optional) — Max results 1-100 (default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: openFDA
- **Base URL**: https://api.fda.gov
- **Auth**: None required
- **Rate Limits**: 240 requests/minute
- **Docs**: https://open.fda.gov/apis/

## Deploy

### Docker

```bash
docker build -t settlegrid-fda-recalls .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fda-recalls
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
