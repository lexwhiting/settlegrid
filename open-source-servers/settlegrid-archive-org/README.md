# settlegrid-archive-org

Internet Archive MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Search the Internet Archive's vast collection of books, media, and web pages.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(query)` | Search Internet Archive | 1¢ |
| `get_metadata(identifier)` | Get item metadata | 1¢ |
| `search_books(query)` | Search books collection | 1¢ |
| `search_audio(query)` | Search audio collection | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Internet Archive
- **Base URL**: https://archive.org
- **Auth**: None (public)
- **Docs**: https://archive.org/developers/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
