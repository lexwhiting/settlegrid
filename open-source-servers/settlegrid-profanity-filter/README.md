# settlegrid-profanity-filter

Profanity Filter MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Check and filter profanity and inappropriate content.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_text(text)` | Check text for profanity | 1¢ |
| `censor_text(text)` | Censor profane words | 1¢ |
| `check_username(username)` | Check if username is appropriate | 1¢ |
| `get_word_count(text)` | Count profane words | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: PurgoMalum
- **Base URL**: https://www.purgomalum.com/service
- **Auth**: None (public)
- **Docs**: https://www.purgomalum.com/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
