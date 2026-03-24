# settlegrid-farm-subsidies

US Farm Subsidy Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-farm-subsidies)

Access US farm subsidy and agricultural program data from USDA Economic Research Service. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_subsidies(state?, year?)` | Get farm subsidy data | 2¢ |
| `list_programs()` | List farm subsidy programs | 1¢ |
| `get_stats(program)` | Get program statistics | 2¢ |

## Parameters

### get_subsidies
- `state` (string) — US state name or abbreviation
- `year` (number) — Year to query (e.g. 2023)

### list_programs

### get_stats
- `program` (string, required) — Program name or identifier

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USDA ERS API — it is completely free.

## Upstream API

- **Provider**: USDA ERS
- **Base URL**: https://data.ers.usda.gov/api
- **Auth**: None required
- **Docs**: https://www.ers.usda.gov/data-products/

## Deploy

### Docker

```bash
docker build -t settlegrid-farm-subsidies .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-farm-subsidies
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
