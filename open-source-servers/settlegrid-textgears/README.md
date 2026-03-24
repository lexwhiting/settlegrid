# settlegrid-textgears

TextGears MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Text analysis, grammar checking, and readability scoring.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_grammar(text)` | Check grammar errors | 2¢ |
| `check_spelling(text)` | Check spelling errors | 1¢ |
| `analyze_readability(text)` | Get readability score | 1¢ |
| `detect_language(text)` | Detect text language | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `TEXTGEARS_API_KEY` | Yes | TextGears API key from [textgears.com](https://textgears.com/) |

## Upstream API

- **Provider**: TextGears
- **Base URL**: https://api.textgears.com
- **Auth**: API key (query param)
- **Docs**: https://textgears.com/api

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
