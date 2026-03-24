# settlegrid-clearbit

Clearbit Company Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-clearbit)

Enrich company data by domain, get logo URLs, and look up company information via Clearbit.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CLEARBIT_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `enrich_company(domain)` | Get company data by domain | 2¢ |
| `get_logo(domain)` | Get company logo URL by domain | 1¢ |

## Parameters

### enrich_company
- `domain` (string, required) — Company domain (e.g. "stripe.com")

### get_logo
- `domain` (string, required) — Company domain

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CLEARBIT_API_KEY` | Yes | Clearbit API key |


## Upstream API

- **Provider**: Clearbit
- **Base URL**: https://company.clearbit.com/v2
- **Auth**: Bearer token required
- **Rate Limits**: Free tier available
- **Docs**: https://clearbit.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-clearbit .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CLEARBIT_API_KEY=xxx -p 3000:3000 settlegrid-clearbit
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
