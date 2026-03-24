# settlegrid-sec-xbrl

SEC XBRL MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sec-xbrl)

XBRL financial data, company concepts, and reporting frames from SEC.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_company_concept(cik, taxonomy, tag)` | Single XBRL concept for a company | 1¢ |
| `get_frames(taxonomy, tag, unit, period)` | Cross-company data for one concept/period | 1¢ |
| `get_company_facts(cik)` | All XBRL facts for a company | 1¢ |

## Parameters

### get_company_concept
- `cik` (string, required) — SEC CIK number
- `taxonomy` (string, required) — Taxonomy (e.g. us-gaap)
- `tag` (string, required) — XBRL tag (e.g. Revenue)

### get_frames
- `taxonomy` (string, required) — Taxonomy (e.g. us-gaap)
- `tag` (string, required) — XBRL tag
- `unit` (string, required) — Unit (e.g. USD)
- `period` (string, required) — Period (e.g. CY2023Q1I)

### get_company_facts
- `cik` (string, required) — SEC CIK number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SEC XBRL API — it is completely free.

## Upstream API

- **Provider**: SEC XBRL
- **Base URL**: https://data.sec.gov
- **Auth**: None required
- **Docs**: https://www.sec.gov/edgar/sec-api-documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-sec-xbrl .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sec-xbrl
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
