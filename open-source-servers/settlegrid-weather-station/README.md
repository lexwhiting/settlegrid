# settlegrid-weather-station

Weather Station MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weather-station)

Personal weather station data from Ambient Weather devices.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_devices()` | List stations | 1¢ |
| `get_device_data(mac_address)` | Get readings | 1¢ |

## Parameters

### get_device_data
- `mac_address` (string, required) — Station MAC address
- `limit` (number, optional) — Number of readings (default 10, max 288)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AMBIENT_APP_KEY` | Yes | Free from ambientweather.net |
| `AMBIENT_API_KEY` | Yes | Free from ambientweather.net |

## Upstream API

- **Provider**: Ambient Weather
- **Auth**: Free API key
- **Docs**: https://ambientweather.docs.apiary.io/

## Deploy

### Docker
```bash
docker build -t settlegrid-weather-station .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-weather-station
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
