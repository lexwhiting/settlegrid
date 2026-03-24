# settlegrid-prime-numbers

Prime Numbers MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Check primality, generate primes, and factorize numbers.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `is_prime(number)` | Check if number is prime | 1¢ |
| `next_prime(after)` | Get next prime after number | 1¢ |
| `factorize(number)` | Prime factorization | 1¢ |
| `generate(count)` | Generate N prime numbers | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Number theory algorithms

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
