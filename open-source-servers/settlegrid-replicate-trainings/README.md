# settlegrid-replicate-trainings

Replicate Trainings MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-replicate-trainings)

Create, manage, and monitor model training jobs on the Replicate platform via its HTTP API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_training(model_owner: string, model_name: string, version_id: string, destination: string, input?: Record<string, unknown>, webhook?: string)` | Create a new training job for a specific model version | 5¢ |
| `list_trainings(cursor?: string)` | List all training jobs for the authenticated account | 1¢ |
| `get_training(training_id: string)` | Get the status and details of a training job by ID | 1¢ |
| `cancel_training(training_id: string)` | Cancel a running training job by ID | 2¢ |
| `get_model(model_owner: string, model_name: string)` | Get details for a specific Replicate model | 1¢ |
| `list_model_versions(model_owner: string, model_name: string)` | List all versions of a specific model | 1¢ |
| `get_account()` | Get the current authenticated Replicate account details | 1¢ |
| `list_hardware()` | List available hardware options for running models | 1¢ |

## Parameters

### create_training
- `model_owner` (string, required) — The owner of the trainable model (e.g. 'stability-ai')
- `model_name` (string, required) — The name of the trainable model (e.g. 'sdxl')
- `version_id` (string, required) — The ID of the model version that supports training
- `destination` (string, required) — The destination model for the trained version in 'owner/name' format
- `input` (object) — Training input parameters as a key-value map (e.g. training data URL, steps)
- `webhook` (string) — URL to receive webhook notifications when the training status changes

### list_trainings
- `cursor` (string) — Pagination cursor from a previous list response

### get_training
- `training_id` (string, required) — The ID of the training job to retrieve

### cancel_training
- `training_id` (string, required) — The ID of the training job to cancel

### get_model
- `model_owner` (string, required) — The username or organization that owns the model
- `model_name` (string, required) — The name of the model

### list_model_versions
- `model_owner` (string, required) — The username or organization that owns the model
- `model_name` (string, required) — The name of the model

### get_account

### list_hardware

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `REPLICATE_API_TOKEN` | Yes | Replicate API key from [https://replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |

## Upstream API

- **Provider**: Replicate
- **Base URL**: https://api.replicate.com
- **Auth**: API key required
- **Docs**: https://replicate.com/docs/reference/http

## Deploy

### Docker

```bash
docker build -t settlegrid-replicate-trainings .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-replicate-trainings
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
