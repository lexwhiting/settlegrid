# settlegrid-smart-citizen

Smart Citizen Sensors MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-smart-citizen)

Access Smart Citizen Kit sensor data for environmental monitoring. Open API, no key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_device(id)` | Get device info and latest readings | 1¢ |
| `list_devices(city?)` | List devices optionally filtered by city | 1¢ |
| `get_readings(device_id, sensor_id?)` | Get historical sensor readings | 2¢ |

## Parameters

### get_device
- `id` (number, required) — Smart Citizen device ID

### list_devices
- `city` (string) — City name to filter devices

### get_readings
- `device_id` (number, required) — Smart Citizen device ID
- `sensor_id` (number) — Specific sensor ID on the device

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Smart Citizen API — it is completely free.

## Upstream API

- **Provider**: Smart Citizen
- **Base URL**: https://api.smartcitizen.me/v0
- **Auth**: None required
- **Docs**: https://developer.smartcitizen.me/

## Deploy

### Docker

```bash
docker build -t settlegrid-smart-citizen .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-smart-citizen
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
