# settlegrid-langfuse-datasets

Langfuse Datasets MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-langfuse-datasets)

Manage Langfuse annotation queues and their items for LLM observability and evaluation workflows.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_annotation_queues(page?: number, limit?: number)` | List all annotation queues | 1¢ |
| `get_annotation_queue(queueId: string)` | Get an annotation queue by ID | 1¢ |
| `create_annotation_queue(name: string, description?: string)` | Create a new annotation queue | 3¢ |
| `list_queue_items(queueId: string, status?: string, page?: number, limit?: number)` | List items in an annotation queue | 1¢ |
| `get_queue_item(queueId: string, itemId: string)` | Get a specific item from an annotation queue | 1¢ |
| `create_queue_item(queueId: string, traceId: string, observationId?: string)` | Add an item to an annotation queue | 3¢ |
| `update_queue_item(queueId: string, itemId: string, status: string)` | Update an annotation queue item | 3¢ |
| `delete_queue_item(queueId: string, itemId: string)` | Remove an item from an annotation queue | 2¢ |

## Parameters

### list_annotation_queues
- `page` (number) — Page number, starts at 1
- `limit` (number) — Number of items per page (default 20, max 50)

### get_annotation_queue
- `queueId` (string, required) — The unique identifier of the annotation queue

### create_annotation_queue
- `name` (string, required) — Name of the annotation queue
- `description` (string) — Optional description for the annotation queue

### list_queue_items
- `queueId` (string, required) — The unique identifier of the annotation queue
- `status` (string) — Filter by status (e.g. PENDING, COMPLETED)
- `page` (number) — Page number, starts at 1
- `limit` (number) — Number of items per page (default 20, max 50)

### get_queue_item
- `queueId` (string, required) — The unique identifier of the annotation queue
- `itemId` (string, required) — The unique identifier of the annotation queue item

### create_queue_item
- `queueId` (string, required) — The unique identifier of the annotation queue
- `traceId` (string, required) — The trace ID to add to the queue
- `observationId` (string) — Optional observation ID within the trace

### update_queue_item
- `queueId` (string, required) — The unique identifier of the annotation queue
- `itemId` (string, required) — The unique identifier of the annotation queue item
- `status` (string, required) — New status for the item (e.g. PENDING, COMPLETED, SKIPPED)

### delete_queue_item
- `queueId` (string, required) — The unique identifier of the annotation queue
- `itemId` (string, required) — The unique identifier of the annotation queue item

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LANGFUSE_PUBLIC_KEY` | Yes | Langfuse API key from [https://cloud.langfuse.com/project/settings](https://cloud.langfuse.com/project/settings) |

## Upstream API

- **Provider**: Langfuse
- **Base URL**: https://cloud.langfuse.com
- **Auth**: API key required
- **Docs**: https://api.reference.langfuse.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-langfuse-datasets .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-langfuse-datasets
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
