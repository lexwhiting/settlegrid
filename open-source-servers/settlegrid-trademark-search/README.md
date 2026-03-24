# settlegrid-trademark-search

USPTO Trademark Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-trademark-search)

Search US trademarks and service marks via the USPTO Trademark API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_trademarks(query, rows)` | Search US trademarks by name or keyword | 1¢ |
| `get_trademark_status(serial_number)` | Get trademark registration status by serial number | 1¢ |

## Parameters

### search_trademarks
- `query` (string, required) — Trademark name or keyword
- `rows` (number, optional) — Results per page 1-50 (default 10)

### get_trademark_status
- `serial_number` (string, required) — Trademark serial number (e.g. "87654321")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: USPTO
- **Base URL**: https://developer.uspto.gov/ds-api
- **Auth**: None required
- **Rate Limits**: See USPTO terms
- **Docs**: https://developer.uspto.gov/api-catalog

## Deploy

### Docker

```bash
docker build -t settlegrid-trademark-search .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-trademark-search
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
