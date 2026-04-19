# settlegrid-portkey-prompts

Portkey Prompts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-portkey-prompts)

Run and manage Portkey prompt templates directly from your application using the Portkey Prompt API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `run_prompt(promptID: string, variables?: Record<string, string>, stream?: boolean)` | Run a Portkey prompt template by ID | 5¢ |

## Parameters

### run_prompt
- `promptID` (string, required) — The ID of the Portkey prompt template to run
- `variables` (object) — Key-value pairs of variables to substitute in the prompt template
- `stream` (boolean) — Whether to stream the response (default: false)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PORTKEY_API_KEY` | Yes | Portkey API key from [https://app.portkey.ai/](https://app.portkey.ai/) |

## Upstream API

- **Provider**: Portkey
- **Base URL**: https://api.portkey.ai
- **Auth**: API key required
- **Docs**: https://docs.portkey.ai/docs/product/prompt-engineering-studio/prompt-api

## Deploy

### Docker

```bash
docker build -t settlegrid-portkey-prompts .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-portkey-prompts
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
