# settlegrid-fal-ai

Fal.ai MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fal-ai)

Submit, monitor, and retrieve results from asynchronous AI model inference jobs on the Fal.ai platform.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `submit_request(appId: string, input: Record<string, unknown>)` | Submit an AI model request to the async queue | 5¢ |
| `get_request_status(requestId: string)` | Check the status of a queued inference request | 1¢ |
| `get_request_result(requestId: string)` | Retrieve the result of a completed inference request | 2¢ |
| `cancel_request(requestId: string)` | Cancel a pending or in-progress queued request | 1¢ |

## Parameters

### submit_request
- `appId` (string, required) — The Fal.ai model/application ID to run (e.g. fal-ai/flux/dev)
- `input` (object, required) — JSON input payload for the model (e.g. { prompt: 'a cat' })

### get_request_status
- `requestId` (string, required) — The request ID returned by submit_request

### get_request_result
- `requestId` (string, required) — The request ID of the completed inference job

### cancel_request
- `requestId` (string, required) — The request ID to cancel

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FAL_API_KEY` | Yes | Fal.ai API key from [https://fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |

## Upstream API

- **Provider**: Fal.ai
- **Base URL**: https://queue.fal.run
- **Auth**: API key required
- **Docs**: https://fal.ai/docs/documentation/model-apis/inference/queue

## Deploy

### Docker

```bash
docker build -t settlegrid-fal-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fal-ai
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
