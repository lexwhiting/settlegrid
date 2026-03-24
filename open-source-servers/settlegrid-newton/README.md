# settlegrid-newton

Newton Math MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Advanced math operations: derivatives, integrals, factoring, and more.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `derive(expression)` | Calculate derivative | 1¢ |
| `integrate(expression)` | Calculate integral | 1¢ |
| `factor(expression)` | Factor expression | 1¢ |
| `simplify(expression)` | Simplify expression | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Newton
- **Base URL**: https://newton.vercel.app/api/v2
- **Auth**: None (public)
- **Docs**: https://github.com/aunyks/newton-api

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
