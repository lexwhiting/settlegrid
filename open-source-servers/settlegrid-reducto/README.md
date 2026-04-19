# settlegrid-reducto

Reducto MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-reducto)

Parse and extract structured data from documents (PDFs, images, and more) using the Reducto document processing API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse_document(document_url: string, options?: { chunk_size?: number, extract_tables?: boolean, extract_images?: boolean })` | Parse a document from a URL and extract structured content | 8¢ |

## Parameters

### parse_document
- `document_url` (string, required) — Publicly accessible URL of the document to parse (PDF, DOCX, image, etc.)
- `chunk_size` (number) — Target chunk size in tokens for splitting extracted content (default: 512, max: 4096)
- `extract_tables` (boolean) — Whether to extract tables from the document (default: true)
- `extract_images` (boolean) — Whether to extract and describe images from the document (default: false)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `REDUCTO_API_KEY` | Yes | Reducto API key from [https://reducto.ai](https://reducto.ai) |

## Upstream API

- **Provider**: Reducto
- **Base URL**: https://v1.api.reducto.ai
- **Auth**: API key required
- **Docs**: https://docs.reducto.ai/api-reference/parse

## Deploy

### Docker

```bash
docker build -t settlegrid-reducto .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-reducto
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
