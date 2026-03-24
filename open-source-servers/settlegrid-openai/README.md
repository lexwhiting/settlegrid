# settlegrid-openai

OpenAI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openai)

GPT chat completions, embeddings, and moderation via OpenAI API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENAI_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Send a chat completion request | 5¢ |
| `create_embedding(input)` | Create text embeddings | 1¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model name (default: "gpt-4o-mini")
- `max_tokens` (number, optional) — Max tokens (default: 1000)

### create_embedding
- `input` (string, required) — Text to embed
- `model` (string, optional) — Model name (default: "text-embedding-3-small")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENAI_API_KEY` | Yes | OpenAI API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

## Upstream API

- **Provider**: OpenAI
- **Base URL**: https://api.openai.com/v1
- **Auth**: API key (bearer)
- **Docs**: https://platform.openai.com/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-openai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENAI_API_KEY=xxx -p 3000:3000 settlegrid-openai
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
