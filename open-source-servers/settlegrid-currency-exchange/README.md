# settlegrid-currency-exchange

Currency Exchange Rate MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-currency-exchange)

Real-time and historical currency exchange rates powered by the European Central Bank. 30+ currencies, no upstream API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_rate(from, to)` | Latest exchange rate between two currencies | 1¢ |
| `convert(amount, from, to)` | Convert a specific amount | 1¢ |
| `get_historical(date, from, to)` | Exchange rate on a specific date | 2¢ |

## Supported Currencies

AUD, BGN, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HUF, IDR, ILS, INR, ISK, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, RON, SEK, SGD, THB, TRY, USD, ZAR

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Frankfurter API.

## Upstream API

- **Provider**: Frankfurter (European Central Bank data)
- **Base URL**: https://api.frankfurter.app
- **Auth**: None required
- **Rate Limits**: Fair use
- **Docs**: https://www.frankfurter.app/docs/

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
