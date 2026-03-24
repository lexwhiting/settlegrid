# settlegrid-clinicaltrials

Clinical Trials Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-clinicaltrials)

Access ClinicalTrials.gov v2 API for clinical trial data. Search trials, get study details, and view condition statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_trials(query, status?, limit?)` | Search clinical trials | 1¢ |
| `get_trial(nctId)` | Get trial details by NCT ID | 1¢ |
| `get_stats(condition)` | Get trial statistics for a condition | 2¢ |

## Parameters

### search_trials
- `query` (string, required) — Search query (e.g. "diabetes", "cancer immunotherapy")
- `status` (string) — Trial status filter (e.g. RECRUITING, COMPLETED)
- `limit` (number) — Max results (default 10, max 50)

### get_trial
- `nctId` (string, required) — NCT identifier (e.g. NCT04280705)

### get_stats
- `condition` (string, required) — Medical condition (e.g. "breast cancer")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ClinicalTrials.gov v2 API API — it is completely free.

## Upstream API

- **Provider**: ClinicalTrials.gov v2 API
- **Base URL**: https://clinicaltrials.gov/api/v2
- **Auth**: None required
- **Docs**: https://clinicaltrials.gov/data-api/api

## Deploy

### Docker

```bash
docker build -t settlegrid-clinicaltrials .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-clinicaltrials
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
