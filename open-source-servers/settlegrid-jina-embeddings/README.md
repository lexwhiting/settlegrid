# settlegrid-jina-embeddings

Jina Embeddings MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-jina-embeddings)

Generate high-quality multimodal multilingual embeddings for text and content using Jina AI's embedding models.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_embeddings(input: string[], model?: string, task?: string, dimensions?: number, normalized?: boolean, encoding_type?: string)` | Generate embeddings for an array of text inputs | 5¢ |
| `create_query_embedding(query: string, model?: string, dimensions?: number, normalized?: boolean)` | Generate a retrieval-optimized embedding for a single query string | 3¢ |
| `create_passage_embeddings(passages: string[], model?: string, dimensions?: number, normalized?: boolean)` | Generate retrieval-optimized embeddings for document passages | 5¢ |

## Parameters

### create_embeddings
- `input` (string[], required) — Array of text strings to embed (max 50 items)
- `model` (string) — Embedding model to use (default: jina-embeddings-v3)
- `task` (string) — Task type for embeddings (e.g. retrieval.query, retrieval.passage, text-matching, classification)
- `dimensions` (number) — Number of dimensions for the output embeddings
- `normalized` (boolean) — Whether to normalize the embeddings to unit length
- `encoding_type` (string) — Encoding format for the embeddings (e.g. float, base64)

### create_query_embedding
- `query` (string, required) — The query text to embed for retrieval tasks
- `model` (string) — Embedding model to use (default: jina-embeddings-v3)
- `dimensions` (number) — Number of dimensions for the output embedding
- `normalized` (boolean) — Whether to normalize the embedding to unit length

### create_passage_embeddings
- `passages` (string[], required) — Array of document passage texts to embed for retrieval indexing (max 50)
- `model` (string) — Embedding model to use (default: jina-embeddings-v3)
- `dimensions` (number) — Number of dimensions for the output embeddings
- `normalized` (boolean) — Whether to normalize the embeddings to unit length

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `JINA_API_KEY` | Yes | Jina AI API key from [https://jina.ai/embeddings](https://jina.ai/embeddings) |

## Upstream API

- **Provider**: Jina AI
- **Base URL**: https://api.jina.ai
- **Auth**: API key required
- **Docs**: https://jina.ai/embeddings

## Deploy

### Docker

```bash
docker build -t settlegrid-jina-embeddings .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-jina-embeddings
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
