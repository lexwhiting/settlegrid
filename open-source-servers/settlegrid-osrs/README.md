# settlegrid-osrs

OSRS MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-osrs)

Old School RuneScape hiscores and Grand Exchange prices.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_hiscores(username)` | Get player hiscores | 1¢ |
| `get_ge_price(item_id)` | Get GE item price | 1¢ |
| `get_ge_latest(limit)` | Get latest GE prices | 1¢ |

## Parameters

### get_hiscores
- `username` (string, required) — RuneScape username
### get_ge_price
- `item_id` (string, required) — Item ID
### get_ge_latest
- `limit` (number, optional) — Max items (default 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: RuneScape / OSRS Wiki
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-osrs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-osrs
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
