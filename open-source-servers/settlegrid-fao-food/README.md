# settlegrid-fao-food

FAO Food & Agriculture Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fao-food)

Access FAO food and agriculture statistics via the FAOSTAT API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_data(dataset, country?, year?)` | Get data from a FAOSTAT dataset | 2¢ |
| `list_datasets()` | List available FAOSTAT datasets | 1¢ |
| `list_countries()` | List available countries/areas | 1¢ |

## Parameters

### get_data
- `dataset` (string, required) — Dataset code (e.g. QCL for crops, FBS for food balance)
- `country` (string) — ISO3 numeric area code (e.g. 231 for USA)
- `year` (string) — Year (e.g. 2022)

### list_datasets

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream FAOSTAT API API — it is completely free.

## Upstream API

- **Provider**: FAOSTAT API
- **Base URL**: https://www.fao.org/faostat/api/v1
- **Auth**: None required
- **Docs**: https://www.fao.org/faostat/en/#data

## Deploy

### Docker

```bash
docker build -t settlegrid-fao-food .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fao-food
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
