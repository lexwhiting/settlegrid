# settlegrid-tracking

Package Tracking MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tracking)

Multi-carrier package tracking for UPS, FedEx, USPS, DHL, and more.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `track_package(tracking_number)` | Track a package | 2¢ |
| `detect_carrier(tracking_number)` | Detect carrier | 1¢ |
| `get_carriers()` | List carriers | 1¢ |

## Parameters

### track_package
- `tracking_number` (string, required) — Tracking number
- `carrier` (string, optional) — Carrier code
### detect_carrier
- `tracking_number` (string, required) — Tracking number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TRACKING_API_KEY` | Yes | Free from 17track.net |

## Upstream API

- **Provider**: 17track
- **Auth**: Free API key
- **Docs**: https://api.17track.net/

## Deploy

### Docker
```bash
docker build -t settlegrid-tracking .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tracking
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
