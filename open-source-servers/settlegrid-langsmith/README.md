# settlegrid-langsmith

LangSmith MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-langsmith)

Manage and query LangSmith tracing sessions, filter views, and deployment info via the LangSmith API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_server_info()` | Get information about the current LangSmith deployment | 1¢ |
| `list_sessions(name?: string, name_contains?: string, limit?: number, offset?: number, include_stats?: boolean)` | List tracing sessions with optional filters | 1¢ |
| `get_session(session_id: string, include_stats?: boolean)` | Get a specific tracing session by ID | 1¢ |
| `create_session(name: string, description?: string, upsert?: boolean)` | Create a new tracing session | 3¢ |
| `delete_session(session_id: string)` | Delete a specific tracing session by ID | 3¢ |
| `get_session_metadata(session_id: string, k?: number, metadata_keys?: string)` | Get top metadata key-value counts for a session | 1¢ |
| `list_session_views(session_id: string)` | List all filter views for a tracing session | 1¢ |
| `get_session_view(session_id: string, view_id: string)` | Get a specific filter view for a tracing session | 1¢ |

## Parameters

### get_server_info

### list_sessions
- `name` (string) — Exact session name to filter by
- `name_contains` (string) — Substring to match against session names
- `limit` (number) — Max number of sessions to return (default 20, max 100)
- `offset` (number) — Pagination offset (default 0)
- `include_stats` (boolean) — Whether to include stats in the response

### get_session
- `session_id` (string, required) — UUID of the tracing session
- `include_stats` (boolean) — Whether to include stats in the response

### create_session
- `name` (string, required) — Name for the new tracing session
- `description` (string) — Optional description for the session
- `upsert` (boolean) — If true, update existing session with same name instead of creating new

### delete_session
- `session_id` (string, required) — UUID of the tracing session to delete

### get_session_metadata
- `session_id` (string, required) — UUID of the tracing session
- `k` (number) — Number of top values to return per key (default 10)
- `metadata_keys` (string) — Comma-separated list of metadata keys to include

### list_session_views
- `session_id` (string, required) — UUID of the tracing session

### get_session_view
- `session_id` (string, required) — UUID of the tracing session
- `view_id` (string, required) — UUID of the filter view

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
docker build -t settlegrid-langsmith .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-langsmith
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
