# settlegrid-fhfa

FHFA Housing Price Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fhfa)

Housing price index data via the FRED API (Federal Reserve).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_hpi(series_id)` | Get FHFA House Price Index series observations | 1¢ |
| `search_series(query)` | Search FRED for housing price series | 1¢ |

## Parameters

### get_hpi
- `series_id` (string, optional)

### search_series
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: FRED (Federal Reserve)
- **Base URL**: https://api.stlouisfed.org/fred
- **Auth**: None required
- **Rate Limits**: 120 req/min
- **Docs**: https://fred.stlouisfed.org/docs/api/fred/

## Deploy

### Docker

```bash
docker build -t settlegrid-fhfa .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fhfa
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
