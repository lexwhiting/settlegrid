# settlegrid-options-data

Options Chain Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-options-data)

Options chain, expirations, and quotes via CBOE delayed data. Calls, puts, Greeks, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_chain(symbol, expiration?)` | Get options chain for symbol | 1¢ |
| `get_expirations(symbol)` | Get available expiration dates | 1¢ |
| `get_quote(symbol)` | Get options quote | 1¢ |

## Parameters

### get_chain
- `symbol` (string, required) — Underlying stock ticker
- `expiration` (string) — Expiration date YYYY-MM-DD

### get_expirations
- `symbol` (string, required) — Underlying stock ticker

### get_quote
- `symbol` (string, required) — Options contract symbol

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CBOE API — it is completely free.

## Upstream API

- **Provider**: CBOE
- **Base URL**: https://cdn.cboe.com/api/global/delayed_quotes
- **Auth**: None required
- **Docs**: https://www.cboe.com/delayed_quotes/

## Deploy

### Docker

```bash
docker build -t settlegrid-options-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-options-data
```

### Vercel

Click the "Deploy with Vercel" button above, or:

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
