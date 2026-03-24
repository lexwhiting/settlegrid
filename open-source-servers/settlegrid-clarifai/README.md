# settlegrid-clarifai

Clarifai MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-clarifai)

AI-powered image and video recognition, NLP, and generative AI

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CLARIFAI_PAT
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_models()` | List available AI models | 1¢ |

## Parameters

### list_models
- `per_page` (number, optional) — Results per page (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CLARIFAI_PAT` | Yes | Clarifai API key from [https://clarifai.com/settings/security](https://clarifai.com/settings/security) |

## Upstream API

- **Provider**: Clarifai
- **Base URL**: https://api.clarifai.com/v2
- **Auth**: API key (bearer)
- **Docs**: https://docs.clarifai.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-clarifai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CLARIFAI_PAT=xxx -p 3000:3000 settlegrid-clarifai
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
