# settlegrid-who-data

WHO Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-who-data)

World Health Organization health indicators and statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_indicators(query)` | List available WHO health indicators | 1¢ |
| `get_indicator_data(indicator_code, country)` | Get data for a specific WHO indicator by country | 1¢ |

## Parameters

### list_indicators
- `query` (string, optional)

### get_indicator_data
- `indicator_code` (string, required)
- `country` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: WHO GHO
- **Base URL**: https://ghoapi.azureedge.net/api
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://www.who.int/data/gho/info/gho-odata-api

## Deploy

### Docker

```bash
docker build -t settlegrid-who-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-who-data
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
