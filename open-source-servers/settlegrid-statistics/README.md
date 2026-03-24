# settlegrid-statistics

Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Perform statistical calculations on datasets.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `descriptive(data)` | Get descriptive statistics | 1¢ |
| `percentile(data, p)` | Calculate percentile | 1¢ |
| `correlation(x, y)` | Pearson correlation | 1¢ |
| `regression(x, y)` | Linear regression | 2¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Statistical algorithms

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
