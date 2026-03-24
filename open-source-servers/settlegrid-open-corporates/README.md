# settlegrid-open-corporates

OpenCorporates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-corporates)

Search the world's largest open database of company records via OpenCorporates.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_companies(query, jurisdiction)` | Search companies by name | 1¢ |
| `get_company(jurisdiction, company_number)` | Get company details by jurisdiction and company number | 1¢ |

## Parameters

### search_companies
- `query` (string, required) — Company name to search
- `jurisdiction` (string, optional) — Jurisdiction code (e.g. "us_ca", "gb")

### get_company
- `jurisdiction` (string, required) — Jurisdiction code (e.g. "us_ca", "gb")
- `company_number` (string, required) — Company registration number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: OpenCorporates
- **Base URL**: https://api.opencorporates.com/v0.4
- **Auth**: None required
- **Rate Limits**: 500 requests/month free
- **Docs**: https://api.opencorporates.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-open-corporates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-corporates
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
