# settlegrid-browserbase

Browserbase MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-browserbase)

Create and manage cloud browser sessions for AI-driven web automation and scraping via the Browserbase API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_session(projectId: string, browserSettings?: object, timeout?: number, proxies?: boolean)` | Create a new cloud browser session | 5¢ |
| `get_session(sessionId: string)` | Retrieve details of an existing browser session | 1¢ |
| `list_sessions(projectId: string, status?: string)` | List all browser sessions for a project | 1¢ |
| `stop_session(sessionId: string)` | Stop and terminate a running browser session | 2¢ |
| `get_session_recording(sessionId: string)` | Retrieve the recording or replay data for a completed session | 2¢ |
| `get_session_logs(sessionId: string)` | Retrieve logs for a browser session | 1¢ |

## Parameters

### create_session
- `projectId` (string, required) — The Browserbase project ID to associate the session with
- `browserSettings` (object) — Optional browser configuration object (viewport, fingerprint, etc.)
- `timeout` (number) — Session timeout in seconds (default 300, max 3600)
- `proxies` (boolean) — Whether to enable residential proxies for the session

### get_session
- `sessionId` (string, required) — The unique identifier of the browser session to retrieve

### list_sessions
- `projectId` (string, required) — The Browserbase project ID to list sessions for
- `status` (string) — Filter sessions by status: RUNNING, ERROR, TIMED_OUT, or COMPLETED

### stop_session
- `sessionId` (string, required) — The unique identifier of the browser session to stop

### get_session_recording
- `sessionId` (string, required) — The unique identifier of the completed browser session

### get_session_logs
- `sessionId` (string, required) — The unique identifier of the browser session to fetch logs for

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BROWSERBASE_API_KEY` | Yes | Browserbase API key from [https://www.browserbase.com/settings](https://www.browserbase.com/settings) |

## Upstream API

- **Provider**: Browserbase
- **Base URL**: https://www.browserbase.com
- **Auth**: API key required
- **Docs**: https://docs.browserbase.com/reference/api/create-a-session

## Deploy

### Docker

```bash
docker build -t settlegrid-browserbase .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-browserbase
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
