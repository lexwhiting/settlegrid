# settlegrid-together-finetune

Together AI Fine-Tuning MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-together-finetune)

Create, monitor, and manage fine-tuning jobs on Together AI's platform via the fine-tuning API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_finetune_job(model: string, training_file: string, n_epochs?: number, learning_rate?: number, suffix?: string)` | Create a new fine-tuning job | 5¢ |
| `list_finetune_jobs(limit?: number)` | List all fine-tuning jobs | 1¢ |
| `get_finetune_job(job_id: string)` | Get details of a specific fine-tuning job | 1¢ |
| `cancel_finetune_job(job_id: string)` | Cancel a running fine-tuning job | 2¢ |
| `list_finetune_events(job_id: string)` | List events/logs for a fine-tuning job | 1¢ |
| `delete_finetune_model(model_id: string)` | Delete a fine-tuned model | 3¢ |

## Parameters

### create_finetune_job
- `model` (string, required) — Base model to fine-tune (e.g. 'togethercomputer/llama-2-7b')
- `training_file` (string, required) — ID of the uploaded training file to use
- `n_epochs` (number) — Number of training epochs (default 1, max 10)
- `learning_rate` (number) — Learning rate for training (e.g. 0.00001)
- `suffix` (string) — Custom suffix to append to the fine-tuned model name

### list_finetune_jobs
- `limit` (number) — Maximum number of jobs to return (default 20, max 50)

### get_finetune_job
- `job_id` (string, required) — The fine-tuning job ID to retrieve

### cancel_finetune_job
- `job_id` (string, required) — The fine-tuning job ID to cancel

### list_finetune_events
- `job_id` (string, required) — The fine-tuning job ID to fetch events for

### delete_finetune_model
- `model_id` (string, required) — The fine-tuned model ID to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TOGETHER_API_KEY` | Yes | Together AI API key from [https://api.together.xyz/settings/api-keys](https://api.together.xyz/settings/api-keys) |

## Upstream API

- **Provider**: Together AI
- **Base URL**: https://api.together.xyz/v1
- **Auth**: API key required
- **Docs**: https://docs.together.ai/reference/post-fine-tunes

## Deploy

### Docker

```bash
docker build -t settlegrid-together-finetune .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-together-finetune
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
