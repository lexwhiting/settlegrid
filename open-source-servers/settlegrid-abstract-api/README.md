# settlegrid-abstract-api

Abstract API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-abstract-api)

Enrich company data, validate emails, and geolocate IPs via Abstract API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ABSTRACT_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `enrich_company(domain)` | Get company data by domain | 2¢ |
| `validate_email(email)` | Validate and check an email address | 2¢ |
| `geolocate_ip(ip)` | Get geolocation data for an IP address | 2¢ |

## Parameters

### enrich_company
- `domain` (string, required) — Company domain (e.g. "stripe.com")

### validate_email
- `email` (string, required) — Email to validate

### geolocate_ip
- `ip` (string, required) — IP address to geolocate

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ABSTRACT_API_KEY` | Yes | Abstract API key |


## Upstream API

- **Provider**: Abstract API
- **Base URL**: https://companyenrichment.abstractapi.com/v1
- **Auth**: API key required (query param)
- **Rate Limits**: Free tier available
- **Docs**: https://www.abstractapi.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-abstract-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ABSTRACT_API_KEY=xxx -p 3000:3000 settlegrid-abstract-api
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
