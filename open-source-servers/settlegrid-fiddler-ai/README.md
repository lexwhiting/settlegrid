# settlegrid-fiddler-ai

Fiddler AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fiddler-ai)

Manage and monitor AI models on the Fiddler platform — list, create, inspect, update, delete, and generate models from samples.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_models(limit?: number, offset?: number)` | List all models in the organization | 1¢ |
| `get_model(model_id: string)` | Get details of a specific model by ID | 1¢ |
| `create_model(project_id: string, name: string, task: string, schema?: string)` | Add a new model to a project | 5¢ |
| `update_model(model_id: string, updates: string)` | Update fields of an existing model | 3¢ |
| `delete_model(model_id: string)` | Delete a model by ID | 5¢ |
| `generate_model_from_samples(project_id: string, name: string, task: string, samples: string)` | Generate a model schema from sample data | 5¢ |

## Parameters

### list_models
- `limit` (number) — Maximum number of models to return (default 20, max 50)
- `offset` (number) — Pagination offset (default 0)

### get_model
- `model_id` (string, required) — The unique identifier of the model

### create_model
- `project_id` (string, required) — The project ID to associate the model with
- `name` (string, required) — Name for the new model
- `task` (string, required) — Model task type (e.g. binary_classification, regression, multiclass_classification)
- `schema` (string) — JSON string describing the model schema/columns

### update_model
- `model_id` (string, required) — The unique identifier of the model to update
- `updates` (string, required) — JSON string of fields to update on the model (e.g. {"name":"new-name"})

### delete_model
- `model_id` (string, required) — The unique identifier of the model to delete

### generate_model_from_samples
- `project_id` (string, required) — The project ID to associate the generated model with
- `name` (string, required) — Name for the generated model
- `task` (string, required) — Model task type (e.g. binary_classification, regression)
- `samples` (string, required) — JSON string array of sample data rows used to infer the model schema

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FIDDLER_API_KEY` | Yes | Fiddler AI API key from [https://app.fiddler.ai/settings/credentials](https://app.fiddler.ai/settings/credentials) |

## Upstream API

- **Provider**: Fiddler AI
- **Base URL**: https://app.fiddler.ai
- **Auth**: API key required
- **Docs**: https://docs.fiddler.ai/api/rest-api

## Deploy

### Docker

```bash
docker build -t settlegrid-fiddler-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fiddler-ai
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
