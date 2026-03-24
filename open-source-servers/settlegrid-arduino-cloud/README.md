# settlegrid-arduino-cloud

Arduino IoT Cloud MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-arduino-cloud)

Access Arduino IoT Cloud things, properties, and device data. Free account with API access.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_things()` | List all Arduino things | 1¢ |
| `get_thing(id)` | Get thing details by ID | 1¢ |
| `get_properties(thing_id)` | Get thing properties and values | 1¢ |

## Parameters

### list_things

### get_thing
- `id` (string, required) — Arduino thing UUID

### get_properties
- `thing_id` (string, required) — Arduino thing UUID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ARDUINO_CLIENT_ID` | Yes | Arduino IoT Cloud API key from [https://cloud.arduino.cc](https://cloud.arduino.cc) |

## Upstream API

- **Provider**: Arduino IoT Cloud
- **Base URL**: https://api2.arduino.cc/iot/v2
- **Auth**: API key required
- **Docs**: https://www.arduino.cc/reference/en/iot/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-arduino-cloud .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-arduino-cloud
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
