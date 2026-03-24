# settlegrid-asx200

ASX 200 MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

ASX 200 Australian stock market index constituent data. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_asx200_info()` | Index overview and sector breakdown | 1¢ |
| `get_asx200_constituents(sector?)` | List all constituents | 1¢ |
| `search_asx200(query)` | Search by ticker or name | Free |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
