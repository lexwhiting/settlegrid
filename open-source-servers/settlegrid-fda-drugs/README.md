# settlegrid-fda-drugs

FDA Drug Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fda-drugs)

FDA drug information, adverse events, and labeling from openFDA.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_drugs(query, limit?)` | Search FDA drug labels | 1¢ |
| `get_adverse_events(drug_name, limit?)` | Get drug adverse events | 1¢ |

## Parameters

### search_drugs
- `query` (string, required) — Drug name or ingredient
- `limit` (number) — Max results (default 10)

### get_adverse_events
- `drug_name` (string, required) — Drug name
- `limit` (number) — Max results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream openFDA API — it is completely free.

## Upstream API

- **Provider**: openFDA
- **Base URL**: https://api.fda.gov/drug
- **Auth**: None required
- **Docs**: https://open.fda.gov/apis/drug/

## Deploy

### Docker

```bash
docker build -t settlegrid-fda-drugs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fda-drugs
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
