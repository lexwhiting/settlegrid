# settlegrid-wifi-data

WiFi Network Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wifi-data)

Search and explore WiFi network data from public wireless network databases. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_networks(lat, lon, radius?)` | Search WiFi networks near a location | 2¢ |
| `get_stats(country?)` | Get WiFi network statistics | 1¢ |
| `get_network(bssid)` | Get network details by BSSID | 1¢ |

## Parameters

### search_networks
- `lat` (number, required) — Center latitude
- `lon` (number, required) — Center longitude
- `radius` (number) — Search radius in km (default: 1)

### get_stats
- `country` (string) — Country code to filter stats (e.g., US)

### get_network
- `bssid` (string, required) — WiFi BSSID/MAC address (e.g., 00:11:22:33:44:55)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream WiGLE API — it is completely free.

## Upstream API

- **Provider**: WiGLE
- **Base URL**: https://api.wigle.net/api/v2
- **Auth**: None required
- **Docs**: https://api.wigle.net/swagger

## Deploy

### Docker

```bash
docker build -t settlegrid-wifi-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-wifi-data
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
