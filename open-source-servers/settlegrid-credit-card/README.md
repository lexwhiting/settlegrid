# settlegrid-credit-card

Credit Card Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-credit-card)

Consumer financial complaint data and credit card information via CFPB. Analyze complaints by product.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_cards(type?)` | Search financial product complaints | 1¢ |
| `get_complaints(product, limit?)` | Get complaints for product | 1¢ |
| `get_stats(state?)` | Get complaint stats by state | 1¢ |

## Parameters

### search_cards
- `type` (string) — Product type: credit_card, mortgage, student_loan, etc.

### get_complaints
- `product` (string, required) — Financial product name
- `limit` (number) — Number of results (default: 10)

### get_stats
- `state` (string) — US state abbreviation (CA, NY, TX, etc.)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CFPB API — it is completely free.

## Upstream API

- **Provider**: CFPB
- **Base URL**: https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1
- **Auth**: None required
- **Docs**: https://www.consumerfinance.gov/data-research/consumer-complaints/

## Deploy

### Docker

```bash
docker build -t settlegrid-credit-card .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-credit-card
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
