# settlegrid-arize-phoenix

Arize Phoenix MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-arize-phoenix)

Manage LLM observability projects, traces, spans, datasets, and experiments via the Arize Phoenix REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_projects(limit?: number)` | List all Phoenix projects | 1¢ |
| `get_project(project_identifier: string)` | Get a Phoenix project by identifier | 1¢ |
| `list_spans(limit?: number)` | List spans across projects | 1¢ |
| `list_datasets(limit?: number)` | List all datasets in Phoenix | 1¢ |
| `get_dataset(dataset_id: string)` | Get a dataset by ID | 1¢ |
| `list_dataset_examples(dataset_id: string, limit?: number)` | List examples within a dataset | 1¢ |
| `list_experiments(limit?: number)` | List all experiments in Phoenix | 1¢ |
| `get_experiment(experiment_id: string)` | Get an experiment by ID | 1¢ |

## Parameters

### list_projects
- `limit` (number) — Max number of projects to return (default 20, max 50)

### get_project
- `project_identifier` (string, required) — The project ID or name identifier

### list_spans
- `limit` (number) — Max number of spans to return (default 20, max 50)

### list_datasets
- `limit` (number) — Max number of datasets to return (default 20, max 50)

### get_dataset
- `dataset_id` (string, required) — The unique dataset ID

### list_dataset_examples
- `dataset_id` (string, required) — The unique dataset ID
- `limit` (number) — Max number of examples to return (default 20, max 50)

### list_experiments
- `limit` (number) — Max number of experiments to return (default 20, max 50)

### get_experiment
- `experiment_id` (string, required) — The unique experiment ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PHOENIX_API_KEY` | Yes | Arize Phoenix API key from [https://app.phoenix.arize.com](https://app.phoenix.arize.com) |

## Upstream API

- **Provider**: Arize Phoenix
- **Base URL**: https://app.phoenix.arize.com
- **Auth**: API key required
- **Docs**: https://arize.com/docs/phoenix/sdk-api-reference/rest-api/overview

## Deploy

### Docker

```bash
docker build -t settlegrid-arize-phoenix .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-arize-phoenix
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
