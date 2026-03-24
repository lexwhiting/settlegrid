# settlegrid-fdic-banks

FDIC Bank Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fdic-banks)

FDIC-insured bank information, financials, and failure data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_institutions(search, limit)` | Search FDIC-insured banks | 1¢ |
| `get_financials(certNumber)` | Bank financial reports | 1¢ |
| `get_failures(limit)` | Recent bank failures | 1¢ |

## Parameters

### search_institutions
- `search` (string, required) — Bank name to search
- `limit` (number) — Max results (default 20)

### get_financials
- `certNumber` (string, required) — FDIC certificate number

### get_failures
- `limit` (number) — Max results (default 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream FDIC BankFind API — it is completely free.

## Upstream API

- **Provider**: FDIC BankFind
- **Base URL**: https://banks.data.fdic.gov/api
- **Auth**: None required
- **Docs**: https://banks.data.fdic.gov/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-fdic-banks .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fdic-banks
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
