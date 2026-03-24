# settlegrid-mistral

Mistral AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mistral)

Mistral and Mixtral model inference via Mistral AI API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + MISTRAL_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Chat completion with Mistral models | 3¢ |
| `list_models()` | List available Mistral models | 1¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model name (default: "mistral-small-latest")
- `max_tokens` (number, optional) — Max tokens (default: 1000)

### list_models

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `MISTRAL_API_KEY` | Yes | Mistral AI API key from [https://console.mistral.ai/api-keys/](https://console.mistral.ai/api-keys/) |

## Upstream API

- **Provider**: Mistral AI
- **Base URL**: https://api.mistral.ai/v1
- **Auth**: API key (bearer)
- **Docs**: https://docs.mistral.ai/

## Deploy

### Docker

```bash
docker build -t settlegrid-mistral .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e MISTRAL_API_KEY=xxx -p 3000:3000 settlegrid-mistral
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
