# settlegrid-hyperbrowser

Hyperbrowser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hyperbrowser)

Create and manage headless browser sessions via the Hyperbrowser API for web scraping and automation.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_session(region?: string, proxy?: string, adblock?: boolean, trackers?: boolean)` | Create a new Hyperbrowser session | 5¢ |
| `get_session(sessionId: string)` | Get details of an existing Hyperbrowser session | 1¢ |
| `stop_session(sessionId: string)` | Stop and terminate a Hyperbrowser session | 2¢ |
| `list_sessions(limit?: number)` | List all active Hyperbrowser sessions | 1¢ |

## Parameters

### create_session
- `region` (string) — Geographic region for the session (e.g. 'us', 'eu')
- `proxy` (string) — Proxy type to use (e.g. 'residential', 'datacenter')
- `adblock` (boolean) — Enable ad blocking in the session (default false)
- `trackers` (boolean) — Block trackers in the session (default false)

### get_session
- `sessionId` (string, required) — The unique identifier of the Hyperbrowser session

### stop_session
- `sessionId` (string, required) — The unique identifier of the Hyperbrowser session to stop

### list_sessions
- `limit` (number) — Maximum number of sessions to return (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HYPERBROWSER_API_KEY` | Yes | Hyperbrowser API key from [https://hyperbrowser.ai](https://hyperbrowser.ai) |

## Upstream API

- **Provider**: Hyperbrowser
- **Base URL**: https://hyperbrowser.ai/api
- **Auth**: API key required
- **Docs**: https://hyperbrowser.ai/docs/sessions/create

## Deploy

### Docker

```bash
docker build -t settlegrid-hyperbrowser .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hyperbrowser
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
