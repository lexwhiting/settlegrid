# settlegrid-cat-facts

Cat Facts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get random cat facts, breeds info, and cat trivia.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_fact()` | Get a random cat fact | 1¢ |
| `get_facts(count)` | Get multiple cat facts | 1¢ |
| `get_breeds()` | List cat breeds | 1¢ |
| `get_breed(breed_id)` | Get breed details | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Cat Facts API / TheCatAPI
- **Base URL**: https://catfact.ninja + https://api.thecatapi.com
- **Auth**: None (public)
- **Docs**: https://catfact.ninja/ + https://docs.thecatapi.com/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
