# settlegrid-smart-plugs

Smart Plugs MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-smart-plugs)

Monitor and control smart plugs and IoT devices via Tuya.

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
| `get_device_status(device_id)` | Get status | 1¢ |
| `toggle_device(device_id)` | Toggle on/off | 2¢ |

## Parameters

### get_device_status / toggle_device
- `device_id` (string, required) — Tuya device ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TUYA_CLIENT_ID` | Yes | Free from iot.tuya.com |
| `TUYA_CLIENT_SECRET` | Yes | Free from iot.tuya.com |

## Upstream API

- **Provider**: Tuya IoT
- **Auth**: Free developer account
- **Docs**: https://developer.tuya.com/

## Deploy

### Docker
```bash
docker build -t settlegrid-smart-plugs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-smart-plugs
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
