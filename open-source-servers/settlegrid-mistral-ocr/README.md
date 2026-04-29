# settlegrid-mistral-ocr

Mistral OCR MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mistral-ocr)

Extract text and structured content from documents and images using Mistral AI's OCR API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `ocr_url(url: string, model?: string, include_image_base64?: boolean)` | Run OCR on a document or image from a URL | 5¢ |
| `ocr_base64(data: string, media_type: string, model?: string, include_image_base64?: boolean)` | Run OCR on a base64-encoded document or image | 5¢ |

## Parameters

### ocr_url
- `url` (string, required) — Publicly accessible URL of the document or image to process
- `model` (string) — Mistral OCR model to use (default: mistral-ocr-latest)
- `include_image_base64` (boolean) — Whether to include base64-encoded images in the response (default: false)

### ocr_base64
- `data` (string, required) — Base64-encoded content of the document or image
- `media_type` (string, required) — MIME type of the document (e.g. image/png, image/jpeg, application/pdf)
- `model` (string) — Mistral OCR model to use (default: mistral-ocr-latest)
- `include_image_base64` (boolean) — Whether to include base64-encoded images in the response (default: false)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `MISTRAL_API_KEY` | Yes | Mistral AI API key from [https://console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) |

## Upstream API

- **Provider**: Mistral AI
- **Base URL**: https://api.mistral.ai
- **Auth**: API key required
- **Docs**: https://docs.mistral.ai/api/#tag/ocr

## Deploy

### Docker

```bash
docker build -t settlegrid-mistral-ocr .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mistral-ocr
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
