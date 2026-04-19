# settlegrid-vespa-document-v1

Vespa Document API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-vespa-document-v1)

Read, write, update, delete, and visit documents in a Vespa content cluster via the /document/v1 REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_document(namespace: string, documentType: string, documentId: string, fieldSet?: string, cluster?: string)` | Get a document by namespace, type, and ID | 1¢ |
| `put_document(namespace: string, documentType: string, documentId: string, fields: Record<string, unknown>, cluster?: string, condition?: string)` | Create or overwrite a document | 3¢ |
| `update_document(namespace: string, documentType: string, documentId: string, fields: Record<string, unknown>, create?: boolean, cluster?: string, condition?: string)` | Partially update a document's fields | 3¢ |
| `delete_document(namespace: string, documentType: string, documentId: string, cluster?: string, condition?: string)` | Delete a document by namespace, type, and ID | 2¢ |
| `visit_documents(namespace: string, documentType: string, wantedDocumentCount?: number, selection?: string, continuation?: string, fieldSet?: string, cluster?: string)` | Visit (list/iterate) documents of a given type in a namespace | 2¢ |
| `visit_all_documents(cluster: string, wantedDocumentCount?: number, selection?: string, continuation?: string, fieldSet?: string)` | Visit all documents across all namespaces and types in a cluster | 2¢ |
| `delete_documents_by_selection(namespace: string, documentType: string, selection: string, cluster?: string)` | Delete all documents matching a selection expression in a namespace and type | 5¢ |
| `visit_group_documents(namespace: string, documentType: string, group: string, wantedDocumentCount?: number, selection?: string, continuation?: string, fieldSet?: string, cluster?: string)` | Visit documents belonging to a specific document group | 2¢ |

## Parameters

### get_document
- `namespace` (string, required) — Document namespace
- `documentType` (string, required) — Document type (schema name)
- `documentId` (string, required) — Document identifier
- `fieldSet` (string) — Comma-separated field set to return (e.g. '[all]')
- `cluster` (string) — Name of the content cluster to use

### put_document
- `namespace` (string, required) — Document namespace
- `documentType` (string, required) — Document type (schema name)
- `documentId` (string, required) — Document identifier
- `fields` (object, required) — Document field values as a JSON object
- `cluster` (string) — Name of the content cluster to use
- `condition` (string) — Conditional write test expression

### update_document
- `namespace` (string, required) — Document namespace
- `documentType` (string, required) — Document type (schema name)
- `documentId` (string, required) — Document identifier
- `fields` (object, required) — Partial update object with field update operations
- `create` (boolean) — Create document if it does not exist
- `cluster` (string) — Name of the content cluster to use
- `condition` (string) — Conditional write test expression

### delete_document
- `namespace` (string, required) — Document namespace
- `documentType` (string, required) — Document type (schema name)
- `documentId` (string, required) — Document identifier
- `cluster` (string) — Name of the content cluster to use
- `condition` (string) — Conditional write test expression

### visit_documents
- `namespace` (string, required) — Document namespace
- `documentType` (string, required) — Document type (schema name)
- `wantedDocumentCount` (number) — Desired number of documents per response (max 500)
- `selection` (string) — Document selection expression to filter documents
- `continuation` (string) — Continuation token for pagination
- `fieldSet` (string) — Which fields to return
- `cluster` (string) — Name of the content cluster to use

### visit_all_documents
- `cluster` (string, required) — Name of the content cluster to use
- `wantedDocumentCount` (number) — Desired number of documents per response (max 500)
- `selection` (string) — Document selection expression to filter documents
- `continuation` (string) — Continuation token for pagination
- `fieldSet` (string) — Which fields to return

### delete_documents_by_selection
- `namespace` (string, required) — Document namespace
- `documentType` (string, required) — Document type (schema name)
- `selection` (string, required) — Document selection expression to filter which documents to delete
- `cluster` (string) — Name of the content cluster to use

### visit_group_documents
- `namespace` (string, required) — Document namespace
- `documentType` (string, required) — Document type (schema name)
- `group` (string, required) — Document group identifier
- `wantedDocumentCount` (number) — Desired number of documents per response (max 500)
- `selection` (string) — Document selection expression to filter documents
- `continuation` (string) — Continuation token for pagination
- `fieldSet` (string) — Which fields to return
- `cluster` (string) — Name of the content cluster to use

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Vespa.ai API — it is completely free.

## Upstream API

- **Provider**: Vespa.ai
- **Base URL**: http://localhost:8080
- **Auth**: None required
- **Docs**: https://docs.vespa.ai/en/document-v1-api-guide.html

## Deploy

### Docker

```bash
docker build -t settlegrid-vespa-document-v1 .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-vespa-document-v1
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
