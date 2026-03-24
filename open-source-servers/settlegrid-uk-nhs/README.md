# settlegrid-uk-nhs

NHS Health Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uk-nhs)

Search NHS health conditions, symptoms and medicines via the NHS API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_conditions(query)` | Search health conditions | 1¢ |
| `get_condition(slug)` | Get condition details | 1¢ |
| `list_medicines(letter?)` | List medicines | 1¢ |

## Parameters

### search_conditions
- `query` (string, required) — Search term for conditions

### get_condition
- `slug` (string, required) — Condition slug (e.g. diabetes)

### list_medicines
- `letter` (string) — Filter by first letter (A-Z)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NHS Conditions API API — it is completely free.

## Upstream API

- **Provider**: NHS Conditions API
- **Base URL**: https://api.nhs.uk
- **Auth**: None required
- **Docs**: https://developer.api.nhs.uk/

## Deploy

### Docker

```bash
docker build -t settlegrid-uk-nhs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-uk-nhs
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
