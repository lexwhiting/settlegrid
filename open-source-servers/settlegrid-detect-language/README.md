# settlegrid-detect-language

Detect Language MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Detect the language of any text string with high accuracy.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `detect(text)` | Detect language of text | 1¢ |
| `detect_batch(texts)` | Detect languages for batch | 2¢ |
| `get_languages()` | List supported languages | 1¢ |
| `get_status()` | Get API account status | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `DETECTLANGUAGE_API_KEY` | Yes | API key from [detectlanguage.com](https://detectlanguage.com/) |

## Upstream API

- **Provider**: Detect Language
- **Base URL**: https://ws.detectlanguage.com/0.2
- **Auth**: API key (header)
- **Docs**: https://detectlanguage.com/documentation

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
