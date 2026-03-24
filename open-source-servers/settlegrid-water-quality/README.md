# settlegrid-water-quality

Water Quality Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-water-quality)

US water quality monitoring data from the Water Quality Portal (USGS/EPA).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_stations(statecode)` | Search water monitoring stations by state | 1¢ |
| `get_results(siteid)` | Get water quality results by site ID | 1¢ |

## Parameters

### search_stations
- `statecode` (string, required)

### get_results
- `siteid` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Water Quality Portal (USGS/EPA)
- **Base URL**: https://www.waterqualitydata.us
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://www.waterqualitydata.us/webservices_documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-water-quality .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-water-quality
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
