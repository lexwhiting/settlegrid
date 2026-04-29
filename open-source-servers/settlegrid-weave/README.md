# settlegrid-weave

Weave (Weights & Biases) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weave)

Query, manage, and analyze LLM traces, calls, objects, feedback, and cost data via the Weights & Biases Weave Service API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_call(project_id: string, call_id: string)` | Read a single call by ID | 1¢ |
| `query_calls(project_id: string, filter?: string, limit?: number)` | Query and stream calls for a project | 2¢ |
| `get_call_stats(project_id: string, filter?: string)` | Query aggregate stats for calls in a project | 2¢ |
| `query_objects(project_id: string, object_type?: string, limit?: number)` | Query Weave objects (models, datasets, etc.) in a project | 2¢ |
| `query_feedback(project_id: string, call_id?: string, limit?: number)` | Query feedback entries for calls in a project | 2¢ |
| `create_feedback(project_id: string, call_id: string, feedback_type: string, payload: string)` | Create feedback on a call | 3¢ |
| `query_cost(project_id: string, filter?: string, limit?: number)` | Query cost records for a project | 2¢ |
| `read_refs(refs: string[])` | Read a batch of Weave object refs | 2¢ |

## Parameters

### get_call
- `project_id` (string, required) — The W&B project ID (entity/project format)
- `call_id` (string, required) — The unique ID of the call to retrieve

### query_calls
- `project_id` (string, required) — The W&B project ID (entity/project format)
- `filter` (string) — Optional JSON-encoded filter object for narrowing results
- `limit` (number) — Max number of calls to return (default 20, max 50)

### get_call_stats
- `project_id` (string, required) — The W&B project ID (entity/project format)
- `filter` (string) — Optional JSON-encoded filter object for narrowing stats

### query_objects
- `project_id` (string, required) — The W&B project ID (entity/project format)
- `object_type` (string) — Optional object type filter (e.g. 'Model', 'Dataset')
- `limit` (number) — Max number of objects to return (default 20, max 50)

### query_feedback
- `project_id` (string, required) — The W&B project ID (entity/project format)
- `call_id` (string) — Optional call ID to filter feedback by a specific call
- `limit` (number) — Max number of feedback entries (default 20, max 50)

### create_feedback
- `project_id` (string, required) — The W&B project ID (entity/project format)
- `call_id` (string, required) — The call ID to attach feedback to
- `feedback_type` (string, required) — Type of feedback (e.g. 'thumbs_up', 'note', 'score')
- `payload` (string, required) — JSON-encoded payload object with feedback details

### query_cost
- `project_id` (string, required) — The W&B project ID (entity/project format)
- `filter` (string) — Optional JSON-encoded filter object for narrowing cost records
- `limit` (number) — Max number of cost records to return (default 20, max 50)

### read_refs
- `refs` (string[], required) — Array of Weave ref URIs to resolve (e.g. weave:///entity/project/object/name:version)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WANDB_API_KEY` | Yes | Weights & Biases Weave API key from [https://wandb.ai/authorize](https://wandb.ai/authorize) |

## Upstream API

- **Provider**: Weights & Biases Weave
- **Base URL**: https://trace.wandb.ai
- **Auth**: API key required
- **Docs**: https://docs.wandb.ai/weave/reference/service-api

## Deploy

### Docker

```bash
docker build -t settlegrid-weave .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-weave
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
