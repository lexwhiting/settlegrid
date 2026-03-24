# settlegrid-v-dem

Democracy Indices MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-v-dem)

Access democracy indices and governance data via World Bank governance indicators.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_index(country, year?)` | Get democracy governance index | 2¢ |
| `list_indicators()` | List governance indicators | 1¢ |
| `list_countries()` | List countries | 1¢ |

## Parameters

### get_index
- `country` (string, required) — ISO country code
- `year` (string) — Year

### list_indicators

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API (V-Dem proxy) API — it is completely free.

## Upstream API

- **Provider**: World Bank API (V-Dem proxy)
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Docs**: https://v-dem.net/

## Deploy

### Docker

```bash
docker build -t settlegrid-v-dem .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-v-dem
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
