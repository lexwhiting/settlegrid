# settlegrid-nanonets

Nanonets MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nanonets)

Interact with Nanonets OCR models to retrieve model details and upload training images via URL.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_model_details(model_id: string)` | Get OCR model details by model ID | 1¢ |
| `upload_training_images_by_url(model_id: string, urls: string[], data?: Array<{ filename: string; object?: Array<{ name: string; ocr_text?: string; bndbox: { xmin: number; ymin: number; xmax: number; ymax: number } }> }>)` | Upload training images to an OCR model using image URLs | 3¢ |

## Parameters

### get_model_details
- `model_id` (string, required) — The unique ID of the Nanonets OCR model to retrieve details for.

### upload_training_images_by_url
- `model_id` (string, required) — The unique ID of the Nanonets OCR model to upload training images to.
- `urls` (string[], required) — Array of publicly accessible image URLs to upload as training data.
- `data` (array) — Optional array of annotation objects, each with a filename and optional bounding box annotations.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NANONETS_API_KEY` | Yes | Nanonets API key from [https://app.nanonets.com/#/keys](https://app.nanonets.com/#/keys) |

## Upstream API

- **Provider**: Nanonets
- **Base URL**: https://app.nanonets.com/api/v2
- **Auth**: API key required
- **Docs**: https://nanonets.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-nanonets .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nanonets
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
