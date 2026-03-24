# settlegrid-libre-translate

LibreTranslate MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Free and open-source machine translation for 30+ languages.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `translate(text, source, target)` | Translate text | 2¢ |
| `detect_language(text)` | Detect text language | 1¢ |
| `get_languages()` | List supported languages | 1¢ |
| `translate_html(html, source, target)` | Translate HTML content | 3¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: LibreTranslate
- **Base URL**: https://libretranslate.com
- **Auth**: None (public)
- **Docs**: https://libretranslate.com/docs/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
