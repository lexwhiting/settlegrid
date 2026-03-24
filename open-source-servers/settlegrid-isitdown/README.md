# settlegrid-isitdown

Is It Down MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Check if websites are up or down.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check(domain)` | Check if website is up | 1¢ |
| `check_batch(domains)` | Check multiple websites | 2¢ |
| `get_headers(domain)` | Get HTTP response headers | 1¢ |
| `measure_latency(domain)` | Measure response time | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in (HTTP checks)
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Direct HTTP requests

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
