# settlegrid-fibonacci

Fibonacci MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Generate Fibonacci sequences and check Fibonacci numbers.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_nth(n)` | Get nth Fibonacci number | 1¢ |
| `generate(count)` | Generate Fibonacci sequence | 1¢ |
| `is_fibonacci(number)` | Check if number is Fibonacci | 1¢ |
| `golden_ratio(n)` | Approximate golden ratio | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Mathematical calculations

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
