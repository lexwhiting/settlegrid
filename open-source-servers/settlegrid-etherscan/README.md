# settlegrid-etherscan

Etherscan MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-etherscan)

Ethereum blockchain data, balances, and transactions via Etherscan.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_balance(address)` | ETH balance for address | 2¢ |
| `get_transactions(address)` | Transaction list for address | 2¢ |
| `get_gas_price()` | Current gas price oracle | 2¢ |

## Parameters

### get_balance
- `address` (string, required) — Ethereum address (0x...)

### get_transactions
- `address` (string, required) — Ethereum address

### get_gas_price

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ETHERSCAN_API_KEY` | Yes | Etherscan API key from [https://etherscan.io/apis](https://etherscan.io/apis) |

## Upstream API

- **Provider**: Etherscan
- **Base URL**: https://api.etherscan.io/api
- **Auth**: API key required
- **Docs**: https://docs.etherscan.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-etherscan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-etherscan
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
