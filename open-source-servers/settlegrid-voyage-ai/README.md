# settlegrid-voyage-ai

Voyage AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-voyage-ai)

Generate high-quality text embeddings using Voyage AI's embedding models via the Voyage AI API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_embeddings(input: string | string[], model: string, input_type?: string, truncation?: boolean, encoding_format?: string)` | Generate embeddings for one or more text strings | 3¢ |
| `create_query_embedding(query: string, model: string, encoding_format?: string)` | Generate an embedding optimised for a search query | 2¢ |
| `create_document_embeddings(documents: string[], model: string, truncation?: boolean, encoding_format?: string)` | Generate embeddings for a batch of documents to be indexed | 3¢ |

## Parameters

### create_embeddings
- `input` (string | string[], required) — A single text string or array of text strings to embed (max 128 strings per batch)
- `model` (string, required) — Voyage model name (e.g. voyage-3-large, voyage-3, voyage-3-lite, voyage-code-3, voyage-finance-2)
- `input_type` (string) — Type of input: 'query' for search queries, 'document' for indexed documents, or null for symmetric tasks
- `truncation` (boolean) — Whether to truncate input texts to fit within the model's context length (default: true)
- `encoding_format` (string) — Format for returned embeddings: 'float' (default) or 'base64'

### create_query_embedding
- `query` (string, required) — The search query text to embed
- `model` (string, required) — Voyage model name (e.g. voyage-3-large, voyage-3, voyage-3-lite)
- `encoding_format` (string) — Format for returned embeddings: 'float' (default) or 'base64'

### create_document_embeddings
- `documents` (string[], required) — Array of document texts to embed for indexing (max 128 documents per batch)
- `model` (string, required) — Voyage model name (e.g. voyage-3-large, voyage-3, voyage-3-lite, voyage-code-3)
- `truncation` (boolean) — Whether to truncate documents to fit within the model's context length (default: true)
- `encoding_format` (string) — Format for returned embeddings: 'float' (default) or 'base64'

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `VOYAGE_API_KEY` | Yes | Voyage AI API key from [https://dash.voyageai.com/api-keys](https://dash.voyageai.com/api-keys) |

## Upstream API

- **Provider**: Voyage AI
- **Base URL**: https://api.voyageai.com/v1
- **Auth**: API key required
- **Docs**: https://docs.voyageai.com/reference/embeddings-api

## Deploy

### Docker

```bash
docker build -t settlegrid-voyage-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-voyage-ai
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
