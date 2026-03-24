# settlegrid-synonyms

Synonyms MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Find synonyms, antonyms, and related words via Datamuse API.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_synonyms(word)` | Find synonyms for a word | 1¢ |
| `get_antonyms(word)` | Find antonyms for a word | 1¢ |
| `get_related(word)` | Find related words | 1¢ |
| `get_rhymes(word)` | Find rhyming words | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Datamuse
- **Base URL**: https://api.datamuse.com
- **Auth**: None (public)
- **Docs**: https://www.datamuse.com/api/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
