# settlegrid-perplexity

Perplexity MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-perplexity)

AI-powered search and chat with real-time web knowledge

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PERPLEXITY_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Chat completion with web-augmented AI | 5¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model name (default: "sonar-small-online")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PERPLEXITY_API_KEY` | Yes | Perplexity API key from [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |

## Upstream API

- **Provider**: Perplexity
- **Base URL**: https://api.perplexity.ai
- **Auth**: API key (bearer)
- **Docs**: https://docs.perplexity.ai/

## Deploy

### Docker

```bash
docker build -t settlegrid-perplexity .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PERPLEXITY_API_KEY=xxx -p 3000:3000 settlegrid-perplexity
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
