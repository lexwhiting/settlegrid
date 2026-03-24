# settlegrid-indeed

Adzuna Job Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-indeed)

Search job listings across multiple countries via the Adzuna API (Indeed alternative).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ADZUNA_APP_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_jobs(query, location, country)` | Search job listings by keyword and location | 2¢ |
| `get_salary(query, location, country)` | Get salary estimates for a job title and location | 2¢ |

## Parameters

### search_jobs
- `query` (string, required) — Job title or keyword
- `location` (string, optional) — Location (city, state, or country)
- `country` (string, optional) — Country code: us, gb, au, ca, de, fr, in, nl, nz, pl, za (default: us)

### get_salary
- `query` (string, required) — Job title
- `location` (string, optional) — Location for salary data
- `country` (string, optional) — Country code (default: us)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ADZUNA_APP_ID` | Yes | Adzuna App ID + API Key (set both ADZUNA_APP_ID and ADZUNA_API_KEY) |


## Upstream API

- **Provider**: Adzuna
- **Base URL**: https://api.adzuna.com/v1/api/jobs
- **Auth**: API key required (query param)
- **Rate Limits**: Free tier: 250/month
- **Docs**: https://developer.adzuna.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-indeed .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ADZUNA_APP_ID=xxx -p 3000:3000 settlegrid-indeed
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
