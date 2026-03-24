# settlegrid-anthropic

Anthropic MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-anthropic)

Claude AI chat completions via Anthropic Messages API

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ANTHROPIC_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `chat(message)` | Send a message to Claude | 5¢ |

## Parameters

### chat
- `message` (string, required) — User message
- `model` (string, optional) — Model name (default: "claude-sonnet-4-20250514")
- `max_tokens` (number, optional) — Max tokens (default: 1000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key from [https://console.anthropic.com/](https://console.anthropic.com/) |

## Upstream API

- **Provider**: Anthropic
- **Base URL**: https://api.anthropic.com/v1
- **Auth**: API key (header)
- **Docs**: https://docs.anthropic.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-anthropic .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ANTHROPIC_API_KEY=xxx -p 3000:3000 settlegrid-anthropic
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
