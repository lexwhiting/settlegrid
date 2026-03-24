# settlegrid-ilo-labor

ILO Labor Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ilo-labor)

Access International Labour Organization statistics via the ILO SDMX API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_indicators(query)` | Search ILO indicators | 1¢ |
| `get_data(indicator, country?)` | Get data for an indicator | 2¢ |
| `list_datasets()` | List available ILO datasets | 1¢ |

## Parameters

### search_indicators
- `query` (string, required) — Search term (e.g. "unemployment", "wages")

### get_data
- `indicator` (string, required) — ILO dataflow ID (e.g. DF_STI_ALL_UNE_DEAP_SEX_AGE_RT)
- `country` (string) — ISO3 country code (e.g. USA, GBR)

### list_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ILO SDMX API API — it is completely free.

## Upstream API

- **Provider**: ILO SDMX API
- **Base URL**: https://www.ilo.org/sdmx/rest
- **Auth**: None required
- **Docs**: https://ilostat.ilo.org/resources/sdmx-tools/

## Deploy

### Docker

```bash
docker build -t settlegrid-ilo-labor .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ilo-labor
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
