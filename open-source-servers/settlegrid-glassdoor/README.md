# settlegrid-glassdoor

Trustpilot Reviews MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-glassdoor)

Search business reviews and ratings via the Trustpilot public API (Glassdoor has no public API).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TRUSTPILOT_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_businesses(query)` | Search businesses on Trustpilot by name | 2¢ |
| `get_reviews(domain)` | Get reviews for a business by domain | 2¢ |

## Parameters

### search_businesses
- `query` (string, required) — Business name to search

### get_reviews
- `domain` (string, required) — Business domain (e.g. "stripe.com")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TRUSTPILOT_API_KEY` | Yes | Trustpilot API key |


## Upstream API

- **Provider**: Trustpilot
- **Base URL**: https://api.trustpilot.com/v1
- **Auth**: API key required (query param)
- **Rate Limits**: Free tier available
- **Docs**: https://documentation-apidocumentation.trustpilot.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-glassdoor .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TRUSTPILOT_API_KEY=xxx -p 3000:3000 settlegrid-glassdoor
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
