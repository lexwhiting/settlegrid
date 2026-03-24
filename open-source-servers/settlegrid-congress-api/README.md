# settlegrid-congress-api

US Congress MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-congress-api)

Congressional bills, members, and votes from congress.gov.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CONGRESS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_bills(query, limit)` | Search congressional bills by keyword | 2¢ |
| `get_member(bioguide_id)` | Get details about a member of Congress by bioguide ID | 2¢ |

## Parameters

### search_bills
- `query` (string, required)
- `limit` (number, optional)

### get_member
- `bioguide_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CONGRESS_API_KEY` | Yes | Free key from api.congress.gov/sign-up |


## Upstream API

- **Provider**: Library of Congress
- **Base URL**: https://api.congress.gov
- **Auth**: Free API key required
- **Rate Limits**: 5000 req/hr (free key)
- **Docs**: https://api.congress.gov

## Deploy

### Docker

```bash
docker build -t settlegrid-congress-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CONGRESS_API_KEY=xxx -p 3000:3000 settlegrid-congress-api
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
