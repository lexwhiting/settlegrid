# settlegrid-sweden-scb

Swedish Statistics (SCB) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sweden-scb)

Access Swedish official statistics from SCB (Statistics Sweden).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_subjects()` | List statistical subjects | 1¢ |
| `get_table_info(path)` | Get table info | 1¢ |
| `get_table_data(path)` | Get table data | 1¢ |

## Parameters

### list_subjects

### get_table_info
- `path` (string, required) — Table path in the hierarchy

### get_table_data
- `path` (string, required) — Table path

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SCB API API — it is completely free.

## Upstream API

- **Provider**: SCB API
- **Base URL**: https://api.scb.se/OV0104/v1/doris/en/ssd
- **Auth**: None required
- **Docs**: https://www.scb.se/en/services/open-data-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-sweden-scb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sweden-scb
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
