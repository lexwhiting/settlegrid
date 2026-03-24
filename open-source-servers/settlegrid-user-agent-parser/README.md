# settlegrid-user-agent-parser

User Agent Parser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Parse user agent strings to extract browser, OS, and device info. All local, no API needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse_user_agent(ua)` | Parse a user agent string | Free |
| `detect_bot(ua)` | Check if UA is a bot/crawler | Free |
| `get_browser_list()` | List known browsers & OS | Free |

## Parameters

### parse_user_agent / detect_bot
- `ua` (string, required) — User agent string

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-user-agent-parser .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-user-agent-parser
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
