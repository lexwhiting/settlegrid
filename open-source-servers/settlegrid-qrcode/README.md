# settlegrid-qrcode

QR Code Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-qrcode)

Generate QR codes for URLs, text, and other data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_qr(data)` | Generate a QR code image URL | 1¢ |

## Parameters

### create_qr
- `data` (string, required) — Data to encode (URL, text, etc.)
- `size` (string, optional) — Image size (e.g. 200x200) (default: "200x200")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream QR Code Generator API.

## Upstream API

- **Provider**: QR Code Generator
- **Base URL**: https://api.qrserver.com/v1
- **Auth**: None required
- **Docs**: https://goqr.me/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-qrcode .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-qrcode
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
