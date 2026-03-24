# settlegrid-sentiment-api

Sentiment API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Analyze text sentiment using open NLP models.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `analyze_sentiment(text)` | Analyze text sentiment | 1¢ |
| `analyze_batch(texts)` | Batch sentiment analysis | 2¢ |
| `get_keywords(text)` | Extract keywords with sentiment | 2¢ |
| `analyze_emotion(text)` | Detect emotions in text | 2¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Sentiment (built-in)
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Built-in analyzer

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
