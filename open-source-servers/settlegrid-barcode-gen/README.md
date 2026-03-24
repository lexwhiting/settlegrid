# settlegrid-barcode-gen

Barcode Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-barcode-gen)

Generate barcodes and QR codes via barcodeapi.org.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate(data, type)` | Generate a barcode image URL | 1¢ |
| `generate_qr(data)` | Generate a QR code image URL | 1¢ |

## Parameters

### generate
- `data` (string, required)
- `type` (string, optional)

### generate_qr
- `data` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: barcodeapi.org
- **Base URL**: https://barcodeapi.org/api
- **Auth**: None required
- **Rate Limits**: Unlimited
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
