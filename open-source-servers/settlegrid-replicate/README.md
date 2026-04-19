# settlegrid-replicate

Replicate MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-replicate)

Run, manage, and monitor AI model predictions on Replicate's cloud infrastructure.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_prediction(version: string, input: Record<string, unknown>, webhook?: string)` | Create a prediction using a model version | 5¢ |
| `get_prediction(prediction_id: string)` | Get a prediction by ID | 1¢ |
| `list_predictions(cursor?: string)` | List recent predictions for the authenticated account | 1¢ |
| `cancel_prediction(prediction_id: string)` | Cancel a running prediction | 2¢ |
| `get_model(model_owner: string, model_name: string)` | Get details for a specific model | 1¢ |
| `list_model_versions(model_owner: string, model_name: string)` | List all versions of a model | 1¢ |
| `create_model_prediction(model_owner: string, model_name: string, input: Record<string, unknown>, webhook?: string)` | Create a prediction using an official model by owner and name | 5¢ |
| `get_account()` | Get the authenticated account details | 1¢ |

## Parameters

### create_prediction
- `version` (string, required) — The model version ID to run (e.g. sha256 hash)
- `input` (object, required) — The model's input as a JSON object (model-specific parameters)
- `webhook` (string) — A URL to receive POST requests with prediction status updates

### get_prediction
- `prediction_id` (string, required) — The ID of the prediction to retrieve

### list_predictions
- `cursor` (string) — Pagination cursor from a previous response

### cancel_prediction
- `prediction_id` (string, required) — The ID of the prediction to cancel

### get_model
- `model_owner` (string, required) — The username or organization that owns the model
- `model_name` (string, required) — The name of the model

### list_model_versions
- `model_owner` (string, required) — The username or organization that owns the model
- `model_name` (string, required) — The name of the model

### create_model_prediction
- `model_owner` (string, required) — The owner of the model (e.g. 'stability-ai')
- `model_name` (string, required) — The name of the model (e.g. 'stable-diffusion')
- `input` (object, required) — The model's input as a JSON object (model-specific parameters)
- `webhook` (string) — A URL to receive POST requests with prediction status updates

### get_account

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
docker build -t settlegrid-replicate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-replicate
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
