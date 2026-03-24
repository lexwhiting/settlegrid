# settlegrid-huggingface-datasets

Hugging Face Datasets MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-huggingface-datasets)

Search and browse ML datasets on Hugging Face Hub.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_datasets(query, limit)` | Search Hugging Face datasets by keyword | 1¢ |
| `get_dataset(dataset_id)` | Get details about a specific dataset | 1¢ |

## Parameters

### search_datasets
- `query` (string, required)
- `limit` (number, optional)

### get_dataset
- `dataset_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Hugging Face
- **Base URL**: https://huggingface.co
- **Auth**: None required
- **Rate Limits**: No published limit (no key)
- **Docs**: https://huggingface.co/docs/hub/api

## Deploy

### Docker

```bash
docker build -t settlegrid-huggingface-datasets .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-huggingface-datasets
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
