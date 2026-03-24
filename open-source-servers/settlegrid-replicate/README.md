# settlegrid-replicate

Replicate MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-replicate)

Run open-source ML models in the cloud via Replicate API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + REPLICATE_API_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_prediction(version, prompt)` | Create a prediction with a model | 5¢ |
| `get_prediction(id)` | Get prediction status and output | 1¢ |

## Parameters

### create_prediction
- `version` (string, required) — Model version hash
- `prompt` (string, required) — Input prompt

### get_prediction
- `id` (string, required) — Prediction ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `REPLICATE_API_TOKEN` | Yes | Replicate API key from [https://replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |

## Upstream API

- **Provider**: Replicate
- **Base URL**: https://api.replicate.com/v1
- **Auth**: API key (bearer)
- **Docs**: https://replicate.com/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-replicate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e REPLICATE_API_TOKEN=xxx -p 3000:3000 settlegrid-replicate
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
