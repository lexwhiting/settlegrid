# settlegrid-langsmith-prompts

LangSmith Prompts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-langsmith-prompts)

Manage and query LangSmith tracing sessions, metadata, and filter views via the LangSmith API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_sessions(name_contains?: string, limit?: number, offset?: number)` | List tracing sessions with optional filters | 1¢ |
| `get_session(session_id: string, include_stats?: boolean)` | Get a specific tracing session by ID | 1¢ |
| `create_session(name: string, description?: string)` | Create a new tracing session | 3¢ |
| `delete_session(session_id: string)` | Delete a specific tracing session by ID | 2¢ |
| `get_session_metadata(session_id: string, k?: number, metadata_keys?: string)` | Get top metadata key values for a tracing session | 1¢ |
| `list_session_views(session_id: string)` | List all filter views for a tracing session | 1¢ |
| `get_server_info()` | Get information about the current LangSmith deployment | 1¢ |

## Parameters

### list_sessions
- `name_contains` (string) — Filter sessions by name substring
- `limit` (number) — Max results to return (default 20, max 100)
- `offset` (number) — Pagination offset (default 0)

### get_session
- `session_id` (string, required) — UUID of the tracing session
- `include_stats` (boolean) — Whether to include session statistics

### create_session
- `name` (string, required) — Name of the new tracing session
- `description` (string) — Optional description for the session

### delete_session
- `session_id` (string, required) — UUID of the tracing session to delete

### get_session_metadata
- `session_id` (string, required) — UUID of the tracing session
- `k` (number) — Number of top values to return per key (default 10)
- `metadata_keys` (string) — Comma-separated list of metadata keys to filter by

### list_session_views
- `session_id` (string, required) — UUID of the tracing session

### get_server_info

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LANGSMITH_API_KEY` | Yes | LangSmith API key from [https://docs.langchain.com/langsmith/create-account-api-key#create-an-api-key](https://docs.langchain.com/langsmith/create-account-api-key#create-an-api-key) |

## Upstream API

- **Provider**: LangSmith
- **Base URL**: https://api.smith.langchain.com
- **Auth**: API key required
- **Docs**: https://docs.smith.langchain.com/reference/api

## Deploy

### Docker

```bash
docker build -t settlegrid-langsmith-prompts .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-langsmith-prompts
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
