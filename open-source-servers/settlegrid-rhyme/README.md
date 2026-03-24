# settlegrid-rhyme

Rhyme Finder MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Find rhymes, near-rhymes, and words that sound alike.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `find_rhymes(word)` | Find perfect rhymes | 1¢ |
| `find_near_rhymes(word)` | Find near/slant rhymes | 1¢ |
| `find_homophones(word)` | Find homophones | 1¢ |
| `sounds_like(word)` | Words that sound similar | 1¢ |

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
