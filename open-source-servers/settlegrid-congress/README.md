# settlegrid-congress

Congress API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-congress)

US Congress bills, members, votes, and committees from congress.gov

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CONGRESS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_bills()` | Search for bills in Congress | 1¢ |
| `get_members()` | Get current members of Congress | 1¢ |

## Parameters

### search_bills
- `offset` (number, optional) — Pagination offset (default: 0)
- `limit` (number, optional) — Results limit (default: 20)

### get_members
- `limit` (number, optional) — Results limit (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CONGRESS_API_KEY` | Yes | Congress API API key from [https://api.congress.gov/sign-up/](https://api.congress.gov/sign-up/) |

## Upstream API

- **Provider**: Congress API
- **Base URL**: https://api.congress.gov/v3
- **Auth**: API key (query)
- **Docs**: https://api.congress.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-congress .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CONGRESS_API_KEY=xxx -p 3000:3000 settlegrid-congress
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
