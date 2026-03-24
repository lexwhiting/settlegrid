# settlegrid-maritime

Maritime AIS MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-maritime)

Live vessel tracking and AIS data from Digitraffic maritime API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_vessels()` | Get latest AIS positions for all vessels | 1¢ |
| `get_vessel(mmsi)` | Get AIS data for a specific vessel by MMSI number | 1¢ |

## Parameters

### get_vessel
- `mmsi` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Digitraffic
- **Base URL**: https://meri.digitraffic.fi/api/ais/v1
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://www.digitraffic.fi/en/marine/

## Deploy

### Docker

```bash
docker build -t settlegrid-maritime .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-maritime
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
