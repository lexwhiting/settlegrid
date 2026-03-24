# settlegrid-animal-facts

Animal Facts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get random facts about various animals.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `random_fact()` | Get a random animal fact | 1¢ |
| `get_facts(animal)` | Get facts about specific animal | 1¢ |
| `list_animals()` | List available animals | 1¢ |
| `random_image(animal)` | Get random animal image | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Various APIs
- **Base URL**: Multiple
- **Auth**: None (public)
- **Docs**: Open animal APIs

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
