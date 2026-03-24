# settlegrid-embassy-data

Embassy Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-embassy-data)

Embassy and consulate locations worldwide.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_embassies_in(country)` | Embassies located in a country | 1¢ |
| `get_embassies_of(country)` | Embassies of a country abroad | 1¢ |
| `search_embassies(query)` | Search embassies | 1¢ |

## Parameters

### get_embassies_in
- `country` (string, required) — Country name or ISO code
### get_embassies_of
- `country` (string, required) — Country name or ISO code
### search_embassies
- `query` (string, required) — Search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Embassy API
- **Base URL**: https://embassy-api.com
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-embassy-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-embassy-data
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
