# settlegrid-deepgram

Deepgram MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-deepgram)

AI-powered speech recognition and language understanding

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + DEEPGRAM_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_models()` | Get available speech recognition models | 1¢ |

## Parameters

### list_models

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key from [https://console.deepgram.com/](https://console.deepgram.com/) |

## Upstream API

- **Provider**: Deepgram
- **Base URL**: https://api.deepgram.com/v1
- **Auth**: API key (bearer)
- **Docs**: https://developers.deepgram.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-deepgram .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e DEEPGRAM_API_KEY=xxx -p 3000:3000 settlegrid-deepgram
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
