# settlegrid-languagetool

LanguageTool MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Grammar and spell checking for 30+ languages via LanguageTool.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_text(text, language)` | Check text for errors | 2¢ |
| `get_languages()` | List supported languages | 1¢ |
| `check_with_rules(text, rules)` | Check with specific rules | 2¢ |
| `get_words()` | Get added dictionary words | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: LanguageTool
- **Base URL**: https://api.languagetool.org/v2
- **Auth**: None (public)
- **Docs**: https://languagetool.org/http-api/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
