# settlegrid-drought-data

Drought Monitoring Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-drought-data)

Access US Drought Monitor data via USDM API. Get current drought conditions, view history, and retrieve statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current(state?)` | Get current drought conditions | 1¢ |
| `get_history(state, weeks?)` | Get drought history for a state | 2¢ |
| `get_stats(date?)` | Get drought statistics by date | 1¢ |

## Parameters

### get_current
- `state` (string) — Two-letter state code (e.g. CA, TX). Defaults to national.

### get_history
- `state` (string, required) — Two-letter state code
- `weeks` (number) — Number of weeks history (default 12)

### get_stats
- `date` (string) — Date (YYYY-MM-DD). Defaults to latest.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Drought Monitor API API — it is completely free.

## Upstream API

- **Provider**: US Drought Monitor API
- **Base URL**: https://usdm.unl.edu/api/v1
- **Auth**: None required
- **Docs**: https://droughtmonitor.unl.edu/DmData/DataDownload/WebServiceInfo.aspx

## Deploy

### Docker

```bash
docker build -t settlegrid-drought-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-drought-data
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
