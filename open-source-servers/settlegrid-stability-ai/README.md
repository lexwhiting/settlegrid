# settlegrid-stability-ai

Stability AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-stability-ai)

Generate images using Stable Diffusion models via Stability AI API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + STABILITY_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_engines()` | List available Stable Diffusion engines | 1¢ |

## Parameters

### list_engines

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `STABILITY_API_KEY` | Yes | Stability AI API key from [https://platform.stability.ai/account/keys](https://platform.stability.ai/account/keys) |

## Upstream API

- **Provider**: Stability AI
- **Base URL**: https://api.stability.ai/v1
- **Auth**: API key (bearer)
- **Docs**: https://platform.stability.ai/docs/api-reference

## Deploy

### Docker

```bash
docker build -t settlegrid-stability-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e STABILITY_API_KEY=xxx -p 3000:3000 settlegrid-stability-ai
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
