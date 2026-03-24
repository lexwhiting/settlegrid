# settlegrid-uv-index

OpenUV MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uv-index)

Real-time UV index data and safe sun exposure times

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENUV_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_uv(lat, lng)` | Get real-time UV index for coordinates | 1¢ |
| `get_protection(lat, lng)` | Get sun protection window times | 1¢ |

## Parameters

### get_uv
- `lat` (number, required) — Latitude
- `lng` (number, required) — Longitude

### get_protection
- `lat` (number, required) — Latitude
- `lng` (number, required) — Longitude

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENUV_API_KEY` | Yes | OpenUV API key from [https://www.openuv.io/](https://www.openuv.io/) |

## Upstream API

- **Provider**: OpenUV
- **Base URL**: https://api.openuv.io/api/v1
- **Auth**: API key (header)
- **Docs**: https://www.openuv.io/uvindex

## Deploy

### Docker

```bash
docker build -t settlegrid-uv-index .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENUV_API_KEY=xxx -p 3000:3000 settlegrid-uv-index
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
