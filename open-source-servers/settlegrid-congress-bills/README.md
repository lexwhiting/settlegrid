# settlegrid-congress-bills

Congressional Bills MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-congress-bills)

Search and retrieve US Congressional bills via the Congress.gov API. Free API key required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_bills(query, congress?, limit?)` | Search Congressional bills | 2¢ |
| `get_bill(congress, type, number)` | Get a specific bill | 2¢ |
| `get_recent(limit?)` | Get recently introduced bills | 1¢ |

## Parameters

### search_bills
- `query` (string, required) — Search query for bills
- `congress` (number) — Congress number (e.g. 118)
- `limit` (number) — Max results (default 20)

### get_bill
- `congress` (number, required) — Congress number (e.g. 118)
- `type` (string, required) — Bill type (hr, s, hjres, sjres)
- `number` (number, required) — Bill number

### get_recent
- `limit` (number) — Max results (default 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CONGRESS_API_KEY` | Yes | Congress.gov API key from [https://api.congress.gov/sign-up/](https://api.congress.gov/sign-up/) |

## Upstream API

- **Provider**: Congress.gov
- **Base URL**: https://api.congress.gov/v3
- **Auth**: API key required
- **Docs**: https://api.congress.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-congress-bills .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-congress-bills
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
