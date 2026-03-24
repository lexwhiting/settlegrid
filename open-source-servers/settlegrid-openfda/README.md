# settlegrid-openfda

OpenFDA MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openfda)

FDA drug adverse events, recalls, and product labeling data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_drugs(search)` | Search drug adverse event reports | 1¢ |
| `get_recalls(search)` | Search food and drug recalls | 1¢ |

## Parameters

### search_drugs
- `search` (string, required) — Search query (e.g. patient.drug.medicinalproduct:aspirin)
- `limit` (number, optional) — Results limit (default: 10)

### get_recalls
- `search` (string, required) — Search query
- `limit` (number, optional) — Results limit (default: 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenFDA API.

## Upstream API

- **Provider**: OpenFDA
- **Base URL**: https://api.fda.gov
- **Auth**: None required
- **Docs**: https://open.fda.gov/apis/

## Deploy

### Docker

```bash
docker build -t settlegrid-openfda .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openfda
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
