# settlegrid-steel

Steel MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-steel)

Manage headless browser sessions, PDFs, and screenshots via the Steel API for AI agents.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_sessions()` | List all active browser sessions | 1¢ |
| `create_session(timeout?: number)` | Create a new headless browser session | 3¢ |
| `get_session(id: string)` | Get details of a browser session by ID | 1¢ |
| `release_session(id: string)` | Release and delete a browser session by ID | 2¢ |
| `list_screenshots()` | List all stored screenshots | 1¢ |
| `get_screenshot(id: string)` | Get a screenshot by ID | 1¢ |
| `list_pdfs()` | List all stored PDFs | 1¢ |
| `get_pdf(id: string)` | Get a PDF by ID | 1¢ |

## Parameters

### list_sessions

### create_session
- `timeout` (number) — Session timeout in milliseconds (default 300000, max 3600000)

### get_session
- `id` (string, required) — Session ID to retrieve

### release_session
- `id` (string, required) — Session ID to release

### list_screenshots

### get_screenshot
- `id` (string, required) — Screenshot ID to retrieve

### list_pdfs

### get_pdf
- `id` (string, required) — PDF ID to retrieve

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `STEEL_API_KEY` | Yes | Steel API key from [https://app.steel.dev](https://app.steel.dev) |

## Upstream API

- **Provider**: Steel
- **Base URL**: https://api.steel.dev
- **Auth**: API key required
- **Docs**: https://docs.steel.dev

## Deploy

### Docker

```bash
docker build -t settlegrid-steel .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-steel
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
