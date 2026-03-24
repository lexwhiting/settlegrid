# settlegrid-bird-songs

Bird Songs MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Access bird sound recordings from Xeno-canto.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_bird(query)` | Search bird recordings | 1¢ |
| `get_recording(id)` | Get recording details | 1¢ |
| `random_bird()` | Get random bird recording | 1¢ |
| `search_by_country(country)` | Bird sounds by country | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Xeno-canto
- **Base URL**: https://xeno-canto.org/api/2
- **Auth**: None (public)
- **Docs**: https://xeno-canto.org/explore/api

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
