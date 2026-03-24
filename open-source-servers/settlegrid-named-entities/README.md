# settlegrid-named-entities

Named Entities MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Extract named entities (people, places, organizations) from text.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `extract_entities(text)` | Extract named entities | 2¢ |
| `get_sentiment(text)` | Get entity-level sentiment | 2¢ |
| `get_language(text)` | Detect text language | 1¢ |
| `get_keywords(text)` | Extract key concepts | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `DANDELION_API_KEY` | Yes | Dandelion API key from [dandelion.eu](https://dandelion.eu/) |

## Upstream API

- **Provider**: Dandelion
- **Base URL**: https://api.dandelion.eu/datatxt
- **Auth**: API key (query param)
- **Docs**: https://dandelion.eu/docs/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
