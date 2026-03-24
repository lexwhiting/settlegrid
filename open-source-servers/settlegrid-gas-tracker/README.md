# settlegrid-gas-tracker

Ethereum Gas Price MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gas-tracker)

Get real-time Ethereum gas prices and historical gas data. Wraps the Etherscan gas oracle API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_gas_prices` | Current gas prices (safe, standard, fast) | 1¢ |
| `get_gas_history` | Recent gas price history | 2¢ |

## Parameters

### get_gas_prices
No parameters required. Returns current gas prices in Gwei.

### get_gas_history
No parameters required. Returns recent gas price snapshots.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ETHERSCAN_API_KEY` | No | Optional Etherscan key for higher rate limits |

## Upstream API

- **Provider**: Etherscan
- **Base URL**: https://api.etherscan.io
- **Auth**: Optional API key
- **Docs**: https://docs.etherscan.io/api-endpoints/gas-tracker

## Deploy

### Docker

```bash
docker build -t settlegrid-gas-tracker .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-gas-tracker
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
