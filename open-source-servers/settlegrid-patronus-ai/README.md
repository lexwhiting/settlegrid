# settlegrid-patronus-ai

Patronus AI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-patronus-ai)

Run AI output evaluations, manage experiments, and access datasets using the Patronus AI evaluation platform.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `run_evaluation(evaluator: string, input: string, output: string, context?: string, expected?: string)` | Run an evaluation against an AI output using a Patronus evaluator | 5¢ |
| `list_evaluators(limit?: number)` | List all available Patronus evaluators | 1¢ |
| `create_experiment(name: string, description?: string, tags?: string[])` | Create a new experiment in Patronus AI | 3¢ |
| `list_experiments(limit?: number)` | List all experiments in Patronus AI | 1¢ |
| `list_datasets(limit?: number)` | List all datasets available in Patronus AI | 1¢ |
| `create_dataset(name: string, description?: string)` | Create a new dataset in Patronus AI | 3¢ |

## Parameters

### run_evaluation
- `evaluator` (string, required) — Name of the Patronus evaluator to use (e.g. 'lynx', 'toxicity')
- `input` (string, required) — The input prompt or question given to the AI model
- `output` (string, required) — The AI model's output or response to evaluate
- `context` (string) — Optional retrieved context or background information for the evaluation
- `expected` (string) — Optional expected or reference output for comparison

### list_evaluators
- `limit` (number) — Maximum number of evaluators to return (default 20, max 50)

### create_experiment
- `name` (string, required) — Name of the experiment to create
- `description` (string) — Optional description for the experiment
- `tags` (string[]) — Optional list of tags to associate with the experiment

### list_experiments
- `limit` (number) — Maximum number of experiments to return (default 20, max 50)

### list_datasets
- `limit` (number) — Maximum number of datasets to return (default 20, max 50)

### create_dataset
- `name` (string, required) — Name of the dataset to create
- `description` (string) — Optional description for the dataset

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PATRONUS_API_KEY` | Yes | Patronus AI API key from [https://app.patronus.ai/settings/api-keys](https://app.patronus.ai/settings/api-keys) |

## Upstream API

- **Provider**: Patronus AI
- **Base URL**: https://api.patronus.ai
- **Auth**: API key required
- **Docs**: https://docs.patronus.ai

## Deploy

### Docker

```bash
docker build -t settlegrid-patronus-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-patronus-ai
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
