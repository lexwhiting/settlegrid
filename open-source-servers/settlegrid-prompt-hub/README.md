# settlegrid-prompt-hub

Prompt Hub MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-prompt-hub)

Manage and retrieve AI prompts from PromptHub, including listing, fetching, creating, updating, and deleting prompts.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_prompts(limit?: number)` | List all prompts in the account | 1¢ |
| `get_prompt(id: string)` | Retrieve a specific prompt by ID | 1¢ |
| `create_prompt(name: string, content: string, description?: string)` | Create a new prompt | 3¢ |
| `update_prompt(id: string, name?: string, content?: string, description?: string)` | Update an existing prompt by ID | 3¢ |
| `delete_prompt(id: string)` | Delete a prompt by ID | 2¢ |

## Parameters

### list_prompts
- `limit` (number) — Maximum number of prompts to return (default 20, max 50)

### get_prompt
- `id` (string, required) — The unique identifier of the prompt

### create_prompt
- `name` (string, required) — Name/title for the new prompt
- `content` (string, required) — The prompt text/content
- `description` (string) — Optional description of the prompt

### update_prompt
- `id` (string, required) — The unique identifier of the prompt to update
- `name` (string) — Updated name/title for the prompt
- `content` (string) — Updated prompt text/content
- `description` (string) — Updated description of the prompt

### delete_prompt
- `id` (string, required) — The unique identifier of the prompt to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PROMPTHUB_API_KEY` | Yes | Prompt Hub API key from [https://app.prompthub.us](https://app.prompthub.us) |

## Upstream API

- **Provider**: Prompt Hub
- **Base URL**: https://app.prompthub.us
- **Auth**: API key required
- **Docs**: https://intercom.help/prompthub/en/articles/8541389-prompthub-api-documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-prompt-hub .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-prompt-hub
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
