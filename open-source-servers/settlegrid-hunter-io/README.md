# settlegrid-hunter-io

Hunter.io Email Finder MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hunter-io)

Find professional email addresses, verify emails, and search domains via Hunter.io.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + HUNTER_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `domain_search(domain)` | Find email addresses for a domain | 2¢ |
| `email_finder(domain, first_name, last_name)` | Find email for a person at a company | 2¢ |
| `email_verifier(email)` | Verify if an email address is valid | 2¢ |

## Parameters

### domain_search
- `domain` (string, required) — Company domain (e.g. "stripe.com")

### email_finder
- `domain` (string, required) — Company domain
- `first_name` (string, required) — Person first name
- `last_name` (string, required) — Person last name

### email_verifier
- `email` (string, required) — Email address to verify

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HUNTER_API_KEY` | Yes | Hunter.io API key |


## Upstream API

- **Provider**: Hunter.io
- **Base URL**: https://api.hunter.io/v2
- **Auth**: API key required (query param)
- **Rate Limits**: 25 free requests/month
- **Docs**: https://hunter.io/api-documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-hunter-io .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e HUNTER_API_KEY=xxx -p 3000:3000 settlegrid-hunter-io
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
