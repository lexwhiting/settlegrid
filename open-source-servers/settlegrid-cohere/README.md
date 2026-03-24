# settlegrid-cohere

Cohere MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cohere)

Text generation, embeddings, and reranking via Cohere API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + COHERE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate(prompt)` | Generate text with Cohere models | 3¢ |
| `embed(texts)` | Create text embeddings | 1¢ |

## Parameters

### generate
- `prompt` (string, required) — Input prompt
- `max_tokens` (number, optional) — Max output tokens (default: 500)

### embed
- `texts` (string[], required) — Array of texts to embed

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COHERE_API_KEY` | Yes | Cohere API key from [https://dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) |

## Upstream API

- **Provider**: Cohere
- **Base URL**: https://api.cohere.ai/v1
- **Auth**: API key (bearer)
- **Docs**: https://docs.cohere.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-cohere .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e COHERE_API_KEY=xxx -p 3000:3000 settlegrid-cohere
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
