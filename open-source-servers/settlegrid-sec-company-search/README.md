# settlegrid-sec-company-search

SEC Company Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sec-company-search)

Search SEC EDGAR for company information and CIK numbers

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(q)` | Search for companies in EDGAR | 1¢ |

## Parameters

### search
- `q` (string, required) — Company name or ticker
- `forms` (string, optional) — Form type filter (e.g. 10-K)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SEC Company Search API.

## Upstream API

- **Provider**: SEC Company Search
- **Base URL**: https://efts.sec.gov/LATEST
- **Auth**: None required
- **Docs**: https://efts.sec.gov/LATEST/search-index

## Deploy

### Docker

```bash
docker build -t settlegrid-sec-company-search .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sec-company-search
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
