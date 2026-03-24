# settlegrid-air-quality-indoor

Indoor Air Quality MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-air-quality-indoor)

Indoor air quality monitoring from Awair devices (CO2, VOC, PM2.5, temp, humidity).

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_devices()` | List devices | 1¢ |
| `get_air_data(device_id)` | Get readings | 1¢ |
| `get_score(device_id)` | Get AQ score | 1¢ |

## Parameters

### get_air_data / get_score
- `device_id` (string, required) — Awair device ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AWAIR_TOKEN` | Yes | Free from developer.getawair.com |

## Upstream API

- **Provider**: Awair
- **Auth**: Free developer token
- **Docs**: https://docs.developer.getawair.com/

## Deploy

### Docker
```bash
docker build -t settlegrid-air-quality-indoor .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-air-quality-indoor
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
