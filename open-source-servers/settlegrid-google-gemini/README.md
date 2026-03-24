# settlegrid-google-gemini

Google Gemini MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-google-gemini)

Google Gemini AI model inference for text and multimodal tasks

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GOOGLE_GEMINI_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate(text)` | Generate content with Gemini | 3¢ |
| `list_models()` | List available Gemini models | 1¢ |

## Parameters

### generate
- `text` (string, required) — Input text prompt

### list_models

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GOOGLE_GEMINI_API_KEY` | Yes | Google Gemini API key from [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

## Upstream API

- **Provider**: Google Gemini
- **Base URL**: https://generativelanguage.googleapis.com/v1beta
- **Auth**: API key (query)
- **Docs**: https://ai.google.dev/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-google-gemini .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GOOGLE_GEMINI_API_KEY=xxx -p 3000:3000 settlegrid-google-gemini
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
