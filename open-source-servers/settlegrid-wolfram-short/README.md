# settlegrid-wolfram-short

Wolfram Short Answers MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get quick answers from Wolfram Alpha's computational engine.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `short_answer(query)` | Get short answer to question | 2¢ |
| `spoken_answer(query)` | Get spoken-form answer | 2¢ |
| `simple_query(query)` | Get simple text result | 1¢ |
| `validate_query(query)` | Check if query is answerable | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `WOLFRAM_APP_ID` | Yes | Wolfram Alpha AppID from [developer.wolframalpha.com](https://developer.wolframalpha.com/) |

## Upstream API

- **Provider**: Wolfram Alpha
- **Base URL**: https://api.wolframalpha.com
- **Auth**: AppID (query param)
- **Docs**: https://products.wolframalpha.com/short-answers-api/documentation

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
