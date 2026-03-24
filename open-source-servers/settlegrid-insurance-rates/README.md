# settlegrid-insurance-rates

Insurance & Provider Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-insurance-rates)

Healthcare insurance plan and provider data via CMS.gov. Search plans, providers, and stats by state.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_plans(state, type?)` | Search insurance plans | 1¢ |
| `get_plan(id)` | Get plan details | 1¢ |
| `get_stats(state)` | Get provider stats by state | 1¢ |

## Parameters

### search_plans
- `state` (string, required) — US state abbreviation
- `type` (string) — Plan type: medical, dental, vision

### get_plan
- `id` (string, required) — Plan identifier

### get_stats
- `state` (string, required) — US state abbreviation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CMS Provider Data API — it is completely free.

## Upstream API

- **Provider**: CMS Provider Data
- **Base URL**: https://data.cms.gov/provider-data/api/1
- **Auth**: None required
- **Docs**: https://data.cms.gov/provider-data/

## Deploy

### Docker

```bash
docker build -t settlegrid-insurance-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-insurance-rates
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
