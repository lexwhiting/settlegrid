# settlegrid-esg-scores

ESG Scores MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-esg-scores)

Company ESG (Environmental, Social, Governance) ratings and benchmarks.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_esg_score(symbol)` | Get ESG score for a company | 2¢ |
| `search_companies(query)` | Search companies | 1¢ |
| `get_industry_benchmark(sector)` | Get industry benchmark | 1¢ |

## Parameters

### get_esg_score
- `symbol` (string, required) — Stock ticker symbol
### search_companies
- `query` (string, required) — Company name search
### get_industry_benchmark
- `sector` (string, required) — Industry sector name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ESG_ENTERPRISE_KEY` | Yes | Free key from esgenterprise.com |

## Upstream API

- **Provider**: ESG Enterprise
- **Auth**: Free API key required
- **Docs**: https://www.esgenterprise.com/esg-api/

## Deploy

### Docker
```bash
docker build -t settlegrid-esg-scores .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-esg-scores
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
