# settlegrid-together-ai

Together AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-together-ai)

Fast inference for open-source models including Llama, Mistral, and more

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + TOGETHER_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Chat completion with open-source models | 3¢ |
| `list_models()` | List available models | 1¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model ID (default: "meta-llama/Llama-3-8b-chat-hf")

### list_models

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TOGETHER_API_KEY` | Yes | Together AI API key from [https://api.together.xyz/settings/api-keys](https://api.together.xyz/settings/api-keys) |

## Upstream API

- **Provider**: Together AI
- **Base URL**: https://api.together.xyz/v1
- **Auth**: API key (bearer)
- **Docs**: https://docs.together.ai/

## Deploy

### Docker

```bash
docker build -t settlegrid-together-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e TOGETHER_API_KEY=xxx -p 3000:3000 settlegrid-together-ai
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
