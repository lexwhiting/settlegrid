# settlegrid-qr-code

QR Code Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-qr-code)

Generate QR codes from text or URLs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_qr(data, size)` | Generate a QR code image URL for given data | 1¢ |
| `read_qr(image_url)` | Read/decode a QR code from an image URL | 1¢ |

## Parameters

### create_qr
- `data` (string, required)
- `size` (number, optional)

### read_qr
- `image_url` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: goQR.me
- **Base URL**: https://goqr.me/api/
- **Auth**: None required
- **Rate Limits**: Unlimited (no key)
- **Docs**: https://goqr.me/api/doc/create-qr-code/

## Deploy

### Docker

```bash
docker build -t settlegrid-qr-code .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-qr-code
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
