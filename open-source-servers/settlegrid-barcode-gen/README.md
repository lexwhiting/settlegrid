# settlegrid-barcode-gen

Barcode Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-barcode-gen)

Generate barcode image URLs for EAN, UPC, Code128, and QR codes.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_barcode(data, type?)` | Generate barcode image URL | 1¢ |

## Parameters

### generate_barcode
- `data` (string, required) — Data to encode
- `type` (string) — Type: 128, ean13, upc, qr (default 128)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream BarcodeAPI API — it is completely free.

## Upstream API

- **Provider**: BarcodeAPI
- **Base URL**: https://barcodeapi.org/api
- **Auth**: None required
- **Docs**: https://barcodeapi.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-barcode-gen .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-barcode-gen
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
