# settlegrid-ais-data

Ship AIS Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ais-data)

Access ship AIS tracking data from the Finnish Digitraffic marine API. Free and open, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_vessels(lat, lon, radius?)` | Get vessels near a location | 2¢ |
| `get_vessel(mmsi)` | Get vessel details by MMSI | 1¢ |
| `get_port(locode)` | Get port information by locode | 1¢ |

## Parameters

### get_vessels
- `lat` (number, required) — Center latitude
- `lon` (number, required) — Center longitude
- `radius` (number) — Search radius in km (default: 20)

### get_vessel
- `mmsi` (number, required) — Maritime Mobile Service Identity number

### get_port
- `locode` (string, required) — UN/LOCODE port code (e.g., FIHEL)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Digitraffic Marine API — it is completely free.

## Upstream API

- **Provider**: Digitraffic Marine
- **Base URL**: https://meri.digitraffic.fi/api/v1
- **Auth**: None required
- **Docs**: https://www.digitraffic.fi/en/marine/

## Deploy

### Docker

```bash
docker build -t settlegrid-ais-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ais-data
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
