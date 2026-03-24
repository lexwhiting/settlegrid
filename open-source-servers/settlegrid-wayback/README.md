# settlegrid-wayback

Wayback Machine MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Check historical snapshots of websites via the Wayback Machine.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_url(url)` | Check if URL has snapshots | 1¢ |
| `get_snapshots(url)` | List available snapshots | 1¢ |
| `get_closest(url, timestamp)` | Get closest snapshot to date | 1¢ |
| `get_sparkline(url)` | Get capture frequency data | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Wayback Machine
- **Base URL**: https://archive.org/wayback/available
- **Auth**: None (public)
- **Docs**: https://archive.org/help/wayback_api.php

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
