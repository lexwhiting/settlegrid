# settlegrid-fireworks-ai

Fireworks AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fireworks-ai)

Access Fireworks AI inference endpoints for chat completions, text completions, embeddings, and image generation using fast open-source models.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_chat_completion(model: string, messages: Array<{role: string, content: string}>, max_tokens?: number, temperature?: number)` | Create a chat completion using a Fireworks AI model | 5¢ |
| `create_text_completion(model: string, prompt: string, max_tokens?: number, temperature?: number)` | Create a text completion using a Fireworks AI model | 5¢ |
| `create_embeddings(model: string, input: string | string[])` | Create embeddings for input text using a Fireworks AI model | 2¢ |
| `create_image(model: string, prompt: string, n?: number, height?: number, width?: number)` | Generate an image from a text prompt using Fireworks AI | 8¢ |
| `list_models()` | List all available Fireworks AI models | 1¢ |
| `get_model(model_id: string)` | Get details about a specific Fireworks AI model | 1¢ |

## Parameters

### create_chat_completion
- `model` (string, required) — Model ID to use (e.g. accounts/fireworks/models/llama-v3p1-8b-instruct)
- `messages` (array, required) — Array of message objects with role (system/user/assistant) and content fields
- `max_tokens` (number) — Maximum number of tokens to generate (default 512, max 4096)
- `temperature` (number) — Sampling temperature between 0 and 2 (default 0.7)

### create_text_completion
- `model` (string, required) — Model ID to use (e.g. accounts/fireworks/models/llama-v3p1-8b-instruct)
- `prompt` (string, required) — The prompt text to complete
- `max_tokens` (number) — Maximum number of tokens to generate (default 256, max 4096)
- `temperature` (number) — Sampling temperature between 0 and 2 (default 0.7)

### create_embeddings
- `model` (string, required) — Embedding model ID (e.g. accounts/fireworks/models/nomic-embed-text-v1-5)
- `input` (string | string[], required) — Text or array of texts to embed

### create_image
- `model` (string, required) — Image model ID (e.g. accounts/fireworks/models/stable-diffusion-xl-1024-v1-0)
- `prompt` (string, required) — Text prompt describing the image to generate
- `n` (number) — Number of images to generate (default 1, max 4)
- `height` (number) — Image height in pixels (default 1024)
- `width` (number) — Image width in pixels (default 1024)

### list_models

### get_model
- `model_id` (string, required) — The full model ID to retrieve details for

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FIREWORKS_API_KEY` | Yes | Fireworks AI API key from [https://fireworks.ai/settings/users/api-keys](https://fireworks.ai/settings/users/api-keys) |

## Upstream API

- **Provider**: Fireworks AI
- **Base URL**: https://api.fireworks.ai/inference
- **Auth**: API key required
- **Docs**: https://docs.fireworks.ai/api-reference/introduction

## Deploy

### Docker

```bash
docker build -t settlegrid-fireworks-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fireworks-ai
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
