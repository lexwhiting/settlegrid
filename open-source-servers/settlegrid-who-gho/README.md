# settlegrid-who-gho

WHO Global Health Observatory MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-who-gho)

Access WHO Global Health Observatory indicators and data via the GHO OData API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicator(code, country?)` | Get data for a GHO indicator | 2¢ |
| `search_indicators(query)` | Search GHO indicators | 1¢ |
| `list_countries()` | List available countries | 1¢ |

## Parameters

### get_indicator
- `code` (string, required) — GHO indicator code (e.g. WHOSIS_000001 for life expectancy)
- `country` (string) — ISO3 country code (e.g. USA, GBR)

### search_indicators
- `query` (string, required) — Search query (e.g. "malaria", "mortality")

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream WHO GHO API API — it is completely free.

## Upstream API

- **Provider**: WHO GHO API
- **Base URL**: https://ghoapi.azureedge.net/api
- **Auth**: None required
- **Docs**: https://www.who.int/data/gho/info/gho-odata-api

## Deploy

### Docker

```bash
docker build -t settlegrid-who-gho .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-who-gho
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
