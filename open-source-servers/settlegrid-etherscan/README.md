# settlegrid-etherscan

Etherscan MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-etherscan)

Ethereum blockchain data including balances, transactions, and token info

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ETHERSCAN_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_balance(address)` | Get ETH balance for an address | 1¢ |
| `get_transactions(address)` | Get transaction list for an address | 2¢ |
| `get_gas_price()` | Get current gas price oracle | 1¢ |

## Parameters

### get_balance
- `address` (string, required) — Ethereum address

### get_transactions
- `address` (string, required) — Ethereum address
- `page` (number, optional) — Page number (default: 1)
- `offset` (number, optional) — Results per page (default: 20)

### get_gas_price

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ETHERSCAN_API_KEY` | Yes | Etherscan API key from [https://etherscan.io/apis](https://etherscan.io/apis) |

## Upstream API

- **Provider**: Etherscan
- **Base URL**: https://api.etherscan.io/api
- **Auth**: API key (query)
- **Docs**: https://docs.etherscan.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-etherscan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ETHERSCAN_API_KEY=xxx -p 3000:3000 settlegrid-etherscan
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
