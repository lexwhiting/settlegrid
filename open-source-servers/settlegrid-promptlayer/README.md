# settlegrid-promptlayer

PromptLayer MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-promptlayer)

Track, manage, and retrieve LLM prompt requests and templates via the PromptLayer API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_request(request_id: number)` | Retrieve a logged request by ID | 1¢ |
| `search_requests(page?: number, per_page?: number, tags?: string)` | Search logged requests with optional filters | 2¢ |
| `get_prompt_template(prompt_name: string, version?: number)` | Retrieve a prompt template by name | 1¢ |
| `list_prompt_templates(page?: number, per_page?: number)` | List all prompt templates in the workspace | 1¢ |
| `create_request_log(provider: string, model: string, prompt: string, response: string, latency_ms?: number)` | Log a new LLM request to PromptLayer | 3¢ |
| `add_request_tags(request_id: number, tags: string[])` | Add tags to an existing logged request | 2¢ |

## Parameters

### get_request
- `request_id` (number, required) — The numeric ID of the PromptLayer request to retrieve

### search_requests
- `page` (number) — Page number for pagination (default 1)
- `per_page` (number) — Results per page (default 10, max 50)
- `tags` (string) — Comma-separated list of tags to filter by

### get_prompt_template
- `prompt_name` (string, required) — The name of the prompt template to retrieve
- `version` (number) — Specific version of the prompt template (defaults to latest)

### list_prompt_templates
- `page` (number) — Page number for pagination (default 1)
- `per_page` (number) — Results per page (default 10, max 50)

### create_request_log
- `provider` (string, required) — LLM provider name (e.g. openai, anthropic)
- `model` (string, required) — Model name used for the request (e.g. gpt-4)
- `prompt` (string, required) — The prompt text sent to the model
- `response` (string, required) — The response text returned by the model
- `latency_ms` (number) — Request latency in milliseconds

### add_request_tags
- `request_id` (number, required) — The numeric ID of the PromptLayer request
- `tags` (string[], required) — Array of tag strings to attach to the request

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PROMPTLAYER_API_KEY` | Yes | PromptLayer API key from [https://promptlayer.com/home](https://promptlayer.com/home) |

## Upstream API

- **Provider**: PromptLayer
- **Base URL**: https://api.promptlayer.com
- **Auth**: API key required
- **Docs**: https://docs.promptlayer.com/reference/get-request

## Deploy

### Docker

```bash
docker build -t settlegrid-promptlayer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-promptlayer
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
