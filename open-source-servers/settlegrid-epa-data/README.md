# settlegrid-epa-data

EPA Environmental Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-epa-data)

US EPA air quality and environmental monitoring data from AQS API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_states()` | List all US states with monitoring data | 1¢ |
| `get_monitors(state, county)` | Get air quality monitors by state and county | 1¢ |

## Parameters

### get_monitors
- `state` (string, required)
- `county` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: US EPA
- **Base URL**: https://aqs.epa.gov/data/api
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://aqs.epa.gov/aqsweb/documents/data_api.html

## Deploy

### Docker

```bash
docker build -t settlegrid-epa-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-epa-data
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
