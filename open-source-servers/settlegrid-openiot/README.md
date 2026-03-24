# settlegrid-openiot

Open IoT Platform MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openiot)

Access ThingsBoard demo IoT platform for device telemetry, attributes, and management. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_devices(type?)` | List devices with optional type filter | 1¢ |
| `get_telemetry(device_id, keys?)` | Get device telemetry data | 1¢ |
| `get_attributes(device_id)` | Get device attributes | 1¢ |

## Parameters

### list_devices
- `type` (string) — Device type to filter by

### get_telemetry
- `device_id` (string, required) — ThingsBoard device ID (UUID)
- `keys` (string) — Comma-separated telemetry keys to retrieve

### get_attributes
- `device_id` (string, required) — ThingsBoard device ID (UUID)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ThingsBoard API — it is completely free.

## Upstream API

- **Provider**: ThingsBoard
- **Base URL**: https://demo.thingsboard.io/api
- **Auth**: None required
- **Docs**: https://thingsboard.io/docs/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-openiot .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openiot
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
