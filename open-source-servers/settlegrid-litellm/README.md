# settlegrid-litellm

LiteLLM MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-litellm)

Interact with LiteLLM proxy for OpenAI-compatible chat completions, text completions, embeddings, and model discovery.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_chat_completion(model: string, messages: Array<{role: string, content: string}>, temperature?: number, max_tokens?: number)` | Send a chat completion request to the LiteLLM proxy | 5¢ |
| `create_completion(model: string, prompt: string, temperature?: number, max_tokens?: number)` | Send a text completion request to the LiteLLM proxy | 5¢ |
| `create_embeddings(model: string, input: string | string[])` | Generate embeddings for input text via the LiteLLM proxy | 2¢ |
| `list_models()` | List all available models on the LiteLLM proxy | 1¢ |
| `get_health()` | Check the health status of the LiteLLM proxy | 1¢ |

## Parameters

### create_chat_completion
- `model` (string, required) — Model name to use (e.g. gpt-4, claude-3-opus)
- `messages` (array, required) — Array of message objects with role and content fields
- `temperature` (number) — Sampling temperature (0.0 - 2.0)
- `max_tokens` (number) — Maximum number of tokens to generate

### create_completion
- `model` (string, required) — Model name to use
- `prompt` (string, required) — Input prompt for text completion
- `temperature` (number) — Sampling temperature (0.0 - 2.0)
- `max_tokens` (number) — Maximum number of tokens to generate

### create_embeddings
- `model` (string, required) — Embedding model name to use (e.g. text-embedding-ada-002)
- `input` (string, required) — Input text or array of texts to embed

### list_models

### get_health

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LITELLM_API_KEY` | Yes | LiteLLM API key from [https://docs.litellm.ai/docs/proxy/virtual_keys](https://docs.litellm.ai/docs/proxy/virtual_keys) |

## Upstream API

- **Provider**: LiteLLM
- **Base URL**: http://0.0.0.0:8000
- **Auth**: API key required
- **Docs**: https://docs.litellm.ai/docs/proxy/quick_start

## Deploy

### Docker

```bash
docker build -t settlegrid-litellm .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-litellm
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
