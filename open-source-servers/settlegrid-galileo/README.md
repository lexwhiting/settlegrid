# settlegrid-galileo

Galileo MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-galileo)

Interact with Galileo AI's project annotation, scorer management, and dataset operations via its REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_annotation_templates(project_id: string)` | List annotation templates for a project | 1¢ |
| `get_annotation_template(project_id: string, template_id: string)` | Get a specific annotation template by ID | 1¢ |
| `get_annotation_rating(project_id: string, template_id: string, trace_id: string)` | Get annotation rating for a trace | 1¢ |
| `get_scorer(scorer_id: string)` | Get a scorer by ID | 1¢ |
| `list_scorers(limit?: number)` | List scorers with optional filters | 1¢ |
| `list_scorer_versions(scorer_id: string)` | List all versions for a specific scorer | 1¢ |
| `get_dataset(dataset_id: string)` | Get a dataset by ID | 1¢ |
| `list_datasets()` | List all available datasets | 1¢ |

## Parameters

### list_annotation_templates
- `project_id` (string, required) — The project UUID to list annotation templates for

### get_annotation_template
- `project_id` (string, required) — The project UUID
- `template_id` (string, required) — The annotation template UUID

### get_annotation_rating
- `project_id` (string, required) — The project UUID
- `template_id` (string, required) — The annotation template UUID
- `trace_id` (string, required) — The trace UUID to retrieve the rating for

### get_scorer
- `scorer_id` (string, required) — The scorer UUID to retrieve

### list_scorers
- `limit` (number) — Maximum number of scorers to return (default 20, max 50)

### list_scorer_versions
- `scorer_id` (string, required) — The scorer UUID to list versions for

### get_dataset
- `dataset_id` (string, required) — The dataset UUID to retrieve

### list_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GALILEO_API_KEY` | Yes | Galileo API key from [https://docs.galileo.ai/api-reference/api_keys/create-api-key](https://docs.galileo.ai/api-reference/api_keys/create-api-key) |

## Upstream API

- **Provider**: Galileo
- **Base URL**: https://api.galileo.ai
- **Auth**: API key required
- **Docs**: https://docs.galileo.ai/api-reference

## Deploy

### Docker

```bash
docker build -t settlegrid-galileo .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-galileo
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
