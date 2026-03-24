# settlegrid-bea

BEA (Bureau of Economic Analysis) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bea)

US GDP, personal income, trade, and industry economic statistics

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BEA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_data(DatasetName, TableName)` | Get economic data from BEA datasets | 2¢ |
| `get_datasets()` | List available BEA datasets | 1¢ |

## Parameters

### get_data
- `DatasetName` (string, required) — Dataset (e.g. NIPA, Regional)
- `TableName` (string, required) — Table name (e.g. T10101 for GDP)
- `Year` (string, optional) — Year or ALL (default: "ALL")
- `Frequency` (string, optional) — Q (quarterly) or A (annual) (default: "Q")

### get_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BEA_API_KEY` | Yes | BEA (Bureau of Economic Analysis) API key from [https://apps.bea.gov/api/signup/](https://apps.bea.gov/api/signup/) |

## Upstream API

- **Provider**: BEA (Bureau of Economic Analysis)
- **Base URL**: https://apps.bea.gov/api/data
- **Auth**: API key (query)
- **Docs**: https://apps.bea.gov/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-bea .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BEA_API_KEY=xxx -p 3000:3000 settlegrid-bea
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
