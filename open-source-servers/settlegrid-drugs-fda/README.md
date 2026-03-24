# settlegrid-drugs-fda

Drugs FDA MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-drugs-fda)

FDA drug labeling, adverse events, and recall data via openFDA.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_labels(query)` | Search drug labels by brand or generic name | 1¢ |
| `search_adverse_events(drug_name)` | Search drug adverse event reports | 1¢ |
| `search_recalls(query)` | Search drug recall enforcement reports | 1¢ |

## Parameters

### search_labels
- `query` (string, required)

### search_adverse_events
- `drug_name` (string, required)

### search_recalls
- `query` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: openFDA
- **Base URL**: https://api.fda.gov
- **Auth**: None required
- **Rate Limits**: 240 req/min (no key), 120k/day (with key)
- **Docs**: https://open.fda.gov/apis/drug/

## Deploy

### Docker

```bash
docker build -t settlegrid-drugs-fda .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-drugs-fda
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
