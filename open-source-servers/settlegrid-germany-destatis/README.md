# settlegrid-germany-destatis

German Statistics (DESTATIS) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-germany-destatis)

Access German federal statistics from DESTATIS GENESIS database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_tables(query)` | Search statistical tables | 1¢ |
| `get_table(name)` | Get table metadata | 1¢ |
| `list_statistics()` | List available statistics | 1¢ |

## Parameters

### search_tables
- `query` (string, required) — Search term

### get_table
- `name` (string, required) — Table name/code

### list_statistics

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DESTATIS GENESIS API — it is completely free.

## Upstream API

- **Provider**: DESTATIS GENESIS
- **Base URL**: https://www-genesis.destatis.de/genesisWS/rest/2020
- **Auth**: None required
- **Docs**: https://www-genesis.destatis.de/genesis/online

## Deploy

### Docker

```bash
docker build -t settlegrid-germany-destatis .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-germany-destatis
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
