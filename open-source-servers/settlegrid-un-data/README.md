# settlegrid-un-data

UN Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-un-data)

United Nations statistical data (population, GDP, trade).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicator(dataflow, key)` | Get UN statistical data by dataflow and key | 1¢ |
| `list_dataflows()` | List available UN data sources (dataflows) | 1¢ |

## Parameters

### get_indicator
- `dataflow` (string, required)
- `key` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: United Nations Statistics Division
- **Base URL**: https://data.un.org
- **Auth**: None required
- **Rate Limits**: No published limit (no key)
- **Docs**: https://data.un.org/Host.aspx?Content=API

## Deploy

### Docker

```bash
docker build -t settlegrid-un-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-un-data
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
