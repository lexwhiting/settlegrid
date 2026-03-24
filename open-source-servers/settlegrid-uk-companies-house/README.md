# settlegrid-uk-companies-house

UK Companies House MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uk-companies-house)

UK company registration data, officers, and filing history

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + COMPANIES_HOUSE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_companies(q)` | Search for UK companies | 1¢ |
| `get_company(company_number)` | Get company details by number | 1¢ |

## Parameters

### search_companies
- `q` (string, required) — Company name search

### get_company
- `company_number` (string, required) — Company number (e.g. 00445790)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COMPANIES_HOUSE_API_KEY` | Yes | UK Companies House API key from [https://developer.company-information.service.gov.uk/](https://developer.company-information.service.gov.uk/) |

## Upstream API

- **Provider**: UK Companies House
- **Base URL**: https://api.company-information.service.gov.uk
- **Auth**: API key (header)
- **Docs**: https://developer.company-information.service.gov.uk/api/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-uk-companies-house .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e COMPANIES_HOUSE_API_KEY=xxx -p 3000:3000 settlegrid-uk-companies-house
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
