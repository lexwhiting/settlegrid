# settlegrid-helicone

Helicone MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-helicone)

Query and manage LLM observability data including requests, datasets, alerts, sessions, and analytics via the Helicone API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_requests(limit?: number, offset?: number)` | List logged LLM requests with pagination | 1¢ |
| `get_request_by_id(requestId: string)` | Retrieve a specific logged LLM request by ID | 1¢ |
| `submit_request_feedback(requestId: string, rating: boolean)` | Submit user feedback for a specific request | 2¢ |
| `query_hql(query: string)` | Query Helicone analytics data using HQL (SQL) | 3¢ |
| `get_datasets()` | List all curated LLM datasets | 1¢ |
| `get_alerts()` | List all configured alerts | 1¢ |
| `get_sessions()` | List all multi-turn agent sessions | 1¢ |
| `get_user_metrics()` | Retrieve user metrics and analytics | 2¢ |

## Parameters

### get_requests
- `limit` (number) — Number of requests to return (default 20, max 100)
- `offset` (number) — Pagination offset (default 0)

### get_request_by_id
- `requestId` (string, required) — The unique ID of the LLM request to retrieve

### submit_request_feedback
- `requestId` (string, required) — The ID of the request to provide feedback for
- `rating` (boolean, required) — Thumbs up (true) or thumbs down (false) feedback

### query_hql
- `query` (string, required) — HQL/SQL query string to run against Helicone analytics data

### get_datasets

### get_alerts

### get_sessions

### get_user_metrics

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HELICONE_API_KEY` | Yes | Helicone API key from [https://www.helicone.ai/settings/api-keys](https://www.helicone.ai/settings/api-keys) |

## Upstream API

- **Provider**: Helicone
- **Base URL**: https://api.helicone.ai
- **Auth**: API key required
- **Docs**: https://docs.helicone.ai

## Deploy

### Docker

```bash
docker build -t settlegrid-helicone .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-helicone
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
