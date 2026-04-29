# settlegrid-openrouter

OpenRouter MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openrouter)

Access and route requests to hundreds of AI language models via the OpenRouter unified API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_chat_completion(model: string, messages: Array<{role: string, content: string}>, max_tokens?: number, temperature?: number)` | Send a chat message to any model via OpenRouter | 5¢ |
| `list_models(supported_parameters?: string)` | List all available models on OpenRouter | 1¢ |
| `get_model(model_id: string)` | Get details for a specific model by ID | 1¢ |
| `get_generation(generation_id: string)` | Retrieve metadata for a specific generation by ID | 1¢ |
| `get_credits()` | Get current credit balance for the authenticated account | 1¢ |

## Parameters

### create_chat_completion
- `model` (string, required) — Model ID to use (e.g. openai/gpt-4o, anthropic/claude-3-5-sonnet)
- `messages` (Array<{role: string, content: string}>, required) — Array of chat messages with role (system/user/assistant) and content
- `max_tokens` (number) — Maximum tokens to generate (default 1024, max 4096)
- `temperature` (number) — Sampling temperature between 0 and 2 (default 1.0)

### list_models
- `supported_parameters` (string) — Filter models by supported parameter (e.g. 'tools', 'stream')

### get_model
- `model_id` (string, required) — Model ID to retrieve details for (e.g. openai/gpt-4o)

### get_generation
- `generation_id` (string, required) — Generation ID returned from a prior chat completion call

### get_credits

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key from [https://openrouter.ai/keys](https://openrouter.ai/keys) |

## Upstream API

- **Provider**: OpenRouter
- **Base URL**: https://openrouter.ai
- **Auth**: API key required
- **Docs**: https://openrouter.ai/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-openrouter .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openrouter
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
