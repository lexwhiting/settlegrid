# settlegrid-text-summary

Text Summary MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Summarize text using MeaningCloud API.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `summarize(text, sentences)` | Summarize text | 2¢ |
| `extract_topics(text)` | Extract key topics | 2¢ |
| `classify_text(text)` | Classify text category | 1¢ |
| `extract_entities(text)` | Extract named entities | 2¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `MEANINGCLOUD_API_KEY` | Yes | MeaningCloud API key from [meaningcloud.com](https://www.meaningcloud.com/) |

## Upstream API

- **Provider**: MeaningCloud
- **Base URL**: https://api.meaningcloud.com
- **Auth**: API key (form body)
- **Docs**: https://www.meaningcloud.com/developer/documentation

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
