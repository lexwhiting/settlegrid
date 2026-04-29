# settlegrid-nomic-atlas

Nomic Atlas MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nomic-atlas)

Generate text and image embeddings and parse or extract content from files using the Nomic Atlas API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `embed_text(texts: string[], model?: string, task_type?: string)` | Generate text embeddings for one or more strings | 3¢ |
| `embed_image(urls: string[], model?: string)` | Generate image embeddings from image URLs | 4¢ |
| `parse_file(file_id: string)` | Parse an uploaded file and return structured content | 5¢ |
| `extract_file(file_id: string, schema?: string)` | Extract structured data from an uploaded file | 5¢ |

## Parameters

### embed_text
- `texts` (string[], required) — Array of text strings to embed (max 50 per call)
- `model` (string) — Embedding model to use (default: nomic-embed-text-v1.5)
- `task_type` (string) — Task type hint: search_query, search_document, classification, clustering (default: search_document)

### embed_image
- `urls` (string[], required) — Array of publicly accessible image URLs to embed (max 20 per call)
- `model` (string) — Embedding model to use (default: nomic-embed-vision-v1.5)

### parse_file
- `file_id` (string, required) — File ID returned from a prior upload to /v1/upload

### extract_file
- `file_id` (string, required) — File ID returned from a prior upload to /v1/upload
- `schema` (string) — Optional JSON schema string describing the fields to extract

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NOMIC_API_KEY` | Yes | Nomic Atlas API key from [https://atlas.nomic.ai/cli-login](https://atlas.nomic.ai/cli-login) |

## Upstream API

- **Provider**: Nomic Atlas
- **Base URL**: https://api.nomic.ai
- **Auth**: API key required
- **Docs**: https://docs.nomic.ai/reference/api/embed-text-v-1-embedding-text-post

## Deploy

### Docker

```bash
docker build -t settlegrid-nomic-atlas .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nomic-atlas
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
