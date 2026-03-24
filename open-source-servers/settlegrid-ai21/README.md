# settlegrid-ai21

AI21 MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ai21)

Jamba and Jurassic language model inference via AI21 Studio

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + AI21_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Chat with Jamba models | 3¢ |
| `paraphrase(text)` | Rewrite text with alternative phrasing | 2¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model name (default: "jamba-instruct")

### paraphrase
- `text` (string, required) — Text to paraphrase

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AI21_API_KEY` | Yes | AI21 API key from [https://studio.ai21.com/account/api-key](https://studio.ai21.com/account/api-key) |

## Upstream API

- **Provider**: AI21
- **Base URL**: https://api.ai21.com/studio/v1
- **Auth**: API key (bearer)
- **Docs**: https://docs.ai21.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-ai21 .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e AI21_API_KEY=xxx -p 3000:3000 settlegrid-ai21
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
