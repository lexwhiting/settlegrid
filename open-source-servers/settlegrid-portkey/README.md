# settlegrid-portkey

Portkey MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-portkey)

Render and execute Portkey prompt templates against configured LLMs via the Portkey Prompt API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `render_prompt(promptId: string, variables?: Record<string, unknown>)` | Render a Portkey prompt template with variables | 1¢ |
| `execute_prompt(promptId: string, variables?: Record<string, unknown>)` | Execute a Portkey prompt template and get an LLM completion | 5¢ |

## Parameters

### render_prompt
- `promptId` (string, required) — The ID of the Portkey prompt template to render
- `variables` (object) — Key-value map of variables to interpolate into the prompt template

### execute_prompt
- `promptId` (string, required) — The ID of the Portkey prompt template to execute
- `variables` (object) — Key-value map of variables to interpolate into the prompt template before completion

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PORTKEY_API_KEY` | Yes | Portkey API key from [https://app.portkey.ai/signup](https://app.portkey.ai/signup) |

## Upstream API

- **Provider**: Portkey
- **Base URL**: https://api.portkey.ai
- **Auth**: API key required
- **Docs**: https://docs.portkey.ai/docs/product/prompt-engineering-studio/prompt-api

## Deploy

### Docker

```bash
docker build -t settlegrid-portkey .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-portkey
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
