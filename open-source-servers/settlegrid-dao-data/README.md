# settlegrid-dao-data

DAO Governance Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dao-data)

Get DAO proposals, voting data, and governance metrics. Uses the free Snapshot GraphQL API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_daos` | List top DAOs by member count | 1¢ |
| `get_proposals(dao)` | Recent proposals for a DAO | 2¢ |

## Parameters

### get_daos
No parameters required.

### get_proposals
- `dao` (string, required) — DAO space ID (e.g. "aave.eth", "uniswapgovernance.eth")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: Snapshot
- **Base URL**: https://hub.snapshot.org/graphql
- **Auth**: None required
- **Docs**: https://docs.snapshot.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-dao-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dao-data
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
