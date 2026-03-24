# settlegrid-huggingface

Hugging Face MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-huggingface)

Run ML model inference via Hugging Face Inference API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + HUGGINGFACE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `infer(model, inputs)` | Run inference on a Hugging Face model | 3¢ |

## Parameters

### infer
- `model` (string, required) — Model ID (e.g. gpt2, bert-base-uncased)
- `inputs` (string, required) — Input text

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HUGGINGFACE_API_KEY` | Yes | Hugging Face API key from [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |

## Upstream API

- **Provider**: Hugging Face
- **Base URL**: https://api-inference.huggingface.co/models
- **Auth**: API key (bearer)
- **Docs**: https://huggingface.co/docs/api-inference/

## Deploy

### Docker

```bash
docker build -t settlegrid-huggingface .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e HUGGINGFACE_API_KEY=xxx -p 3000:3000 settlegrid-huggingface
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
