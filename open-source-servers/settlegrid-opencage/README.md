# settlegrid-opencage

OpenCage MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-opencage)

Forward and reverse geocoding using OpenStreetMap and other sources

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENCAGE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `geocode(q)` | Geocode an address to coordinates | 1¢ |

## Parameters

### geocode
- `q` (string, required) — Address or place name
- `limit` (number, optional) — Max results (default: 5)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENCAGE_API_KEY` | Yes | OpenCage API key from [https://opencagedata.com/api](https://opencagedata.com/api) |

## Upstream API

- **Provider**: OpenCage
- **Base URL**: https://api.opencagedata.com/geocode/v1
- **Auth**: API key (query)
- **Docs**: https://opencagedata.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-opencage .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENCAGE_API_KEY=xxx -p 3000:3000 settlegrid-opencage
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
