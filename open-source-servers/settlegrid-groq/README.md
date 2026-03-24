# settlegrid-groq

Groq MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-groq)

Ultra-fast LLM inference on Groq LPUs for Llama, Mixtral, and Gemma

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GROQ_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Chat completion with ultra-fast inference | 3¢ |
| `list_models()` | List available models | 1¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model name (default: "llama3-8b-8192")
- `max_tokens` (number, optional) — Max tokens (default: 1000)

### list_models

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GROQ_API_KEY` | Yes | Groq API key from [https://console.groq.com/keys](https://console.groq.com/keys) |

## Upstream API

- **Provider**: Groq
- **Base URL**: https://api.groq.com/openai/v1
- **Auth**: API key (bearer)
- **Docs**: https://console.groq.com/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-groq .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GROQ_API_KEY=xxx -p 3000:3000 settlegrid-groq
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
