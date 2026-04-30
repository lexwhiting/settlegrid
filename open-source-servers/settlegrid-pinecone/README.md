# settlegrid-pinecone

Pinecone MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pinecone)

Search, manage, and import vectors in Pinecone vector database indexes via the Data Plane API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `query_vectors(indexHost: string, vector: number[], topK?: number, namespace?: string, includeMetadata?: boolean)` | Search a namespace using a query vector | 2¢ |
| `get_index_stats(indexHost: string, namespace?: string)` | Get statistics about the contents of an index | 1¢ |
| `fetch_vectors(indexHost: string, ids: string[], namespace?: string)` | Fetch vectors by ID from a namespace | 1¢ |
| `list_vectors(indexHost: string, namespace?: string, prefix?: string, limit?: number, paginationToken?: string)` | List vector IDs in a namespace with optional prefix filter | 1¢ |
| `delete_vectors(indexHost: string, ids: string[], namespace?: string)` | Delete vectors by ID from a namespace | 2¢ |
| `start_bulk_import(indexHost: string, uri: string, errorMode?: string)` | Start an asynchronous bulk import of vectors from object storage | 5¢ |
| `list_bulk_imports(indexHost: string, limit?: number, paginationToken?: string)` | List all recent and ongoing bulk import operations | 1¢ |
| `describe_bulk_import(indexHost: string, id: string)` | Get details of a specific bulk import operation | 1¢ |

## Parameters

### query_vectors
- `indexHost` (string, required) — The host URL of the Pinecone index (e.g. my-index-abc123.svc.pinecone.io)
- `vector` (number[], required) — The query vector to search with
- `topK` (number) — Number of most similar results to return (default 10, max 100)
- `namespace` (string) — The namespace to search within
- `includeMetadata` (boolean) — Whether to include vector metadata in the response

### get_index_stats
- `indexHost` (string, required) — The host URL of the Pinecone index (e.g. my-index-abc123.svc.pinecone.io)
- `namespace` (string) — Optional namespace filter for stats

### fetch_vectors
- `indexHost` (string, required) — The host URL of the Pinecone index
- `ids` (string[], required) — Array of vector IDs to fetch (no spaces allowed)
- `namespace` (string) — The namespace to fetch vectors from

### list_vectors
- `indexHost` (string, required) — The host URL of the Pinecone index
- `namespace` (string) — The namespace to list vector IDs from
- `prefix` (string) — Filter vector IDs by this prefix
- `limit` (number) — Max number of IDs to return per page (default 100, max 100)
- `paginationToken` (string) — Pagination token from a previous list operation

### delete_vectors
- `indexHost` (string, required) — The host URL of the Pinecone index
- `ids` (string[], required) — Array of vector IDs to delete
- `namespace` (string) — The namespace to delete vectors from

### start_bulk_import
- `indexHost` (string, required) — The host URL of the Pinecone index
- `uri` (string, required) — URI of the object storage location containing vectors to import (e.g. s3://bucket/path)
- `errorMode` (string) — How to handle errors during import: 'CONTINUE' or 'ABORT' (default CONTINUE)

### list_bulk_imports
- `indexHost` (string, required) — The host URL of the Pinecone index
- `limit` (number) — Max number of imports to return per page (default 100, max 100)
- `paginationToken` (string) — Pagination token from a previous list operation

### describe_bulk_import
- `indexHost` (string, required) — The host URL of the Pinecone index
- `id` (string, required) — Unique identifier of the import operation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PINECONE_API_KEY` | Yes | Pinecone API key from [https://app.pinecone.io](https://app.pinecone.io) |

## Upstream API

- **Provider**: Pinecone
- **Base URL**: https://{index_host}
- **Auth**: API key required
- **Docs**: https://docs.pinecone.io/reference/api/introduction

## Deploy

### Docker

```bash
docker build -t settlegrid-pinecone .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pinecone
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
