# settlegrid-drugbank

FDA Drug Information MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-drugbank)

Access drug data via the openFDA drug API. Search drugs, get label information, and find drug interactions.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_drugs(query, limit?)` | Search drugs by name or ingredient | 1¢ |
| `get_drug(id)` | Get drug label by application number | 1¢ |
| `get_interactions(drug_name)` | Get adverse event data for a drug | 2¢ |

## Parameters

### search_drugs
- `query` (string, required) — Drug name or active ingredient (e.g. "aspirin", "ibuprofen")
- `limit` (number) — Max results (default 10, max 100)

### get_drug
- `id` (string, required) — Application number or drug name

### get_interactions
- `drug_name` (string, required) — Drug brand or generic name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream openFDA Drug API API — it is completely free.

## Upstream API

- **Provider**: openFDA Drug API
- **Base URL**: https://api.fda.gov/drug
- **Auth**: None required
- **Docs**: https://open.fda.gov/apis/drug/

## Deploy

### Docker

```bash
docker build -t settlegrid-drugbank .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-drugbank
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
