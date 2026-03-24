# settlegrid-bis-banking

Bank for Intl Settlements Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bis-banking)

Access Bank for International Settlements financial statistics via the BIS SDMX API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_data(dataset, key?)` | Get BIS dataset data | 2¢ |
| `list_datasets()` | List available BIS datasets | 1¢ |
| `search_data(query)` | Search BIS data | 1¢ |

## Parameters

### get_data
- `dataset` (string, required) — BIS dataset ID (e.g. WS_CBPOL_D, WS_XRU_D)
- `key` (string) — Series key filter (e.g. "A.US")

### list_datasets

### search_data
- `query` (string, required) — Search query (e.g. "exchange rates", "credit")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream BIS SDMX API API — it is completely free.

## Upstream API

- **Provider**: BIS SDMX API
- **Base URL**: https://data.bis.org/api/v2
- **Auth**: None required
- **Docs**: https://data.bis.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-bis-banking .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bis-banking
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
