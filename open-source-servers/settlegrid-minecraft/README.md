# settlegrid-minecraft

Minecraft MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-minecraft)

Minecraft server status, player counts, and server info.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_server_status(address)` | Get Java server status | 1¢ |
| `get_server_icon(address)` | Get server icon | 1¢ |
| `get_bedrock_status(address)` | Get Bedrock status | 1¢ |

## Parameters

### All methods
- `address` (string, required) — Server address (e.g. mc.hypixel.net)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: mcsrvstat.us
- **Auth**: None required
- **Docs**: https://api.mcsrvstat.us/

## Deploy

### Docker
```bash
docker build -t settlegrid-minecraft .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-minecraft
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
