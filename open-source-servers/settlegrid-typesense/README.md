# settlegrid-typesense

Typesense MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-typesense)

Search, index, and manage collections and documents on a self-hosted Typesense search engine.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_collections(limit?: number, offset?: number)` | List all collections in the Typesense instance | 1¢ |
| `get_collection(collectionName: string)` | Retrieve details of a single collection by name | 1¢ |
| `create_collection(name: string, fields: object[], defaultSortingField?: string)` | Create a new collection with a schema definition | 3¢ |
| `delete_collection(collectionName: string)` | Permanently delete a collection and all its documents | 5¢ |
| `search_documents(collectionName: string, q: string, queryBy: string, filterBy?: string, sortBy?: string, page?: number, perPage?: number)` | Search for documents in a collection using a query | 2¢ |
| `index_document(collectionName: string, document: object, action?: string)` | Index (create or upsert) a document in a collection | 2¢ |
| `delete_documents(collectionName: string, filterBy: string, batchSize?: number)` | Delete documents from a collection matching a filter condition | 4¢ |
| `update_documents(collectionName: string, filterBy: string, fields: object)` | Update fields on documents in a collection matching a filter condition | 3¢ |

## Parameters

### list_collections
- `limit` (number) — Number of collections to fetch (default 20, max 100)
- `offset` (number) — Starting point to return collections for pagination

### get_collection
- `collectionName` (string, required) — The name of the collection to retrieve

### create_collection
- `name` (string, required) — Name for the new collection
- `fields` (object[], required) — Array of field definitions (each with name, type, optional facet/optional flags)
- `defaultSortingField` (string) — Name of an int32 or float field to use as the default sorting field

### delete_collection
- `collectionName` (string, required) — The name of the collection to delete

### search_documents
- `collectionName` (string, required) — The name of the collection to search
- `q` (string, required) — The search query string
- `queryBy` (string, required) — Comma-separated list of fields to search in (e.g. 'title,description')
- `filterBy` (string) — Filter condition (e.g. 'price:<100 && category:shoes')
- `sortBy` (string) — Sort order (e.g. 'price:asc')
- `page` (number) — Page number for pagination (default 1)
- `perPage` (number) — Number of results per page (default 10, max 50)

### index_document
- `collectionName` (string, required) — The name of the collection to add the document to
- `document` (object, required) — The document object to index; must conform to the collection schema
- `action` (string) — Action to perform: 'create', 'upsert', 'update', or 'emplace' (default: create)

### delete_documents
- `collectionName` (string, required) — The name of the collection to delete documents from
- `filterBy` (string, required) — Filter condition to match documents for deletion (e.g. 'score:<10')
- `batchSize` (number) — Number of documents to delete per batch (default 40, max 1000)

### update_documents
- `collectionName` (string, required) — The name of the collection to update documents in
- `filterBy` (string, required) — Filter condition to match documents for updating (e.g. 'status:=active')
- `fields` (object, required) — Key-value pairs of fields to update on matching documents

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TYPESENSE_API_KEY` | Yes | Typesense API key from [https://typesense.org/docs/latest/api/api-keys.html](https://typesense.org/docs/latest/api/api-keys.html) |

## Upstream API

- **Provider**: Typesense
- **Base URL**: http://localhost:8108
- **Auth**: API key required
- **Docs**: https://typesense.org/docs/latest/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-typesense .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-typesense
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
