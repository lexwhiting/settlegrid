# settlegrid-cohere-embed

Cohere Embed MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cohere-embed)

Generate semantic text embeddings using Cohere's embedding models for similarity, search, and classification tasks.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `embed_texts(texts: string[], model?: string, input_type?: string, embedding_types?: string[])` | Generate embeddings for one or more texts | 5¢ |
| `embed_single(text: string, model?: string, input_type?: string)` | Generate an embedding for a single text string | 3¢ |

## Parameters

### embed_texts
- `texts` (string[], required) — Array of strings to embed (max 96 texts per request)
- `model` (string) — Embedding model to use (e.g. embed-english-v3.0, embed-multilingual-v3.0). Defaults to embed-english-v3.0.
- `input_type` (string) — Intended downstream task: search_document, search_query, classification, or clustering. Defaults to search_document.
- `embedding_types` (string[]) — Types of embeddings to return: float, int8, uint8, binary, ubinary. Defaults to ['float'].

### embed_single
- `text` (string, required) — The text string to embed
- `model` (string) — Embedding model to use (e.g. embed-english-v3.0, embed-multilingual-v3.0). Defaults to embed-english-v3.0.
- `input_type` (string) — Intended downstream task: search_document, search_query, classification, or clustering. Defaults to search_query.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COHERE_API_KEY` | Yes | Cohere API key from [https://dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) |

## Upstream API

- **Provider**: Cohere
- **Base URL**: https://api.cohere.com
- **Auth**: API key required
- **Docs**: https://docs.cohere.com/reference/embed

## Deploy

### Docker

```bash
docker build -t settlegrid-cohere-embed .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cohere-embed
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
