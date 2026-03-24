# settlegrid-ocr-space

OCR.space MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ocr-space)

Extract text from images and PDFs via OCR.space API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OCR_SPACE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `extract_text(url, language)` | Extract text from an image URL | 3¢ |
| `extract_from_pdf(url)` | Extract text from a PDF URL | 3¢ |

## Parameters

### extract_text
- `url` (string, required)
- `language` (string, optional)

### extract_from_pdf
- `url` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OCR_SPACE_API_KEY` | Yes | Free key from ocr.space/ocrapi |


## Upstream API

- **Provider**: OCR.space
- **Base URL**: https://ocr.space
- **Auth**: Free API key required
- **Rate Limits**: 25,000 calls/month (free)
- **Docs**: https://ocr.space/ocrapi

## Deploy

### Docker

```bash
docker build -t settlegrid-ocr-space .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OCR_SPACE_API_KEY=xxx -p 3000:3000 settlegrid-ocr-space
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
