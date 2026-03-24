# settlegrid-openrouter

OpenRouter MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openrouter)

Unified API for 100+ AI models (GPT-4, Claude, Llama, Mistral, etc.)

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENROUTER_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Send a chat completion to any supported model | 3¢ |
| `list_models()` | List all available models and pricing | 1¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model ID (default: "openai/gpt-4o-mini")
- `max_tokens` (number, optional) — Max tokens (default: 1000)

### list_models

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key from [https://openrouter.ai/keys](https://openrouter.ai/keys) |

## Upstream API

- **Provider**: OpenRouter
- **Base URL**: https://openrouter.ai/api/v1
- **Auth**: API key (bearer)
- **Docs**: https://openrouter.ai/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-openrouter .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENROUTER_API_KEY=xxx -p 3000:3000 settlegrid-openrouter
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
