# settlegrid-uk-companies

UK Companies House MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uk-companies)

Search UK company registrations and filings.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + COMPANIES_HOUSE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_companies(query)` | Search for UK companies by name | 2¢ |
| `get_company(company_number)` | Get details of a specific UK company by number | 2¢ |

## Parameters

### search_companies
- `query` (string, required)

### get_company
- `company_number` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COMPANIES_HOUSE_API_KEY` | Yes | Free key from developer.company-information.service.gov.uk |


## Upstream API

- **Provider**: UK Companies House
- **Base URL**: https://developer.company-information.service.gov.uk
- **Auth**: Free API key required
- **Rate Limits**: 600 req/5min
- **Docs**: https://developer.company-information.service.gov.uk/api/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-uk-companies .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e COMPANIES_HOUSE_API_KEY=xxx -p 3000:3000 settlegrid-uk-companies
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
