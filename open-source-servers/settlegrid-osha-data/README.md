# settlegrid-osha-data

OSHA Inspection Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-osha-data)

OSHA workplace safety inspection data from the DOL API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_osha_inspections(establishment?, state?)` | Search OSHA inspections | 1¢ |

## Parameters

### search_osha_inspections
- `establishment` (string) — Establishment name
- `state` (string) — State code (e.g. CA, TX)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DOL OSHA API — it is completely free.

## Upstream API

- **Provider**: DOL OSHA
- **Base URL**: https://data.dol.gov/get/inspection
- **Auth**: None required
- **Docs**: https://developer.dol.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-osha-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-osha-data
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
