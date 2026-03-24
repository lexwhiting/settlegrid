# settlegrid-particle

Particle IoT Devices MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-particle)

Access Particle IoT device data, variables, and diagnostics. Free access token required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_devices()` | List all devices on account | 1¢ |
| `get_device(id)` | Get device info and status | 1¢ |
| `get_variable(device_id, variable)` | Read a device variable | 1¢ |

## Parameters

### list_devices

### get_device
- `id` (string, required) — Particle device ID or name

### get_variable
- `device_id` (string, required) — Device ID or name
- `variable` (string, required) — Variable name exposed by firmware

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PARTICLE_ACCESS_TOKEN` | Yes | Particle API key from [https://particle.io](https://particle.io) |

## Upstream API

- **Provider**: Particle
- **Base URL**: https://api.particle.io/v1
- **Auth**: API key required
- **Docs**: https://docs.particle.io/reference/cloud-apis/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-particle .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-particle
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
