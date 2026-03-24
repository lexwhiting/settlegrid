# settlegrid-denmark-dst

Danish Statistics (DST) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-denmark-dst)

Access Danish statistics from Statistics Denmark (StatBank).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_subjects(subject_id?)` | List subject areas | 1¢ |
| `get_table_info(id)` | Get table info | 1¢ |
| `get_table_data(table, variables)` | Get table data | 1¢ |

## Parameters

### list_subjects
- `subject_id` (string) — Parent subject ID for sub-subjects

### get_table_info
- `id` (string, required) — Table ID

### get_table_data
- `table` (string, required) — Table ID
- `variables` (object, required) — Variable selections as key-value pairs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream StatBank Denmark API — it is completely free.

## Upstream API

- **Provider**: StatBank Denmark
- **Base URL**: https://api.statbank.dk/v1
- **Auth**: None required
- **Docs**: https://www.dst.dk/en/Statistik/brug-statistikken/muligheder-i-telefonisk-markup/api

## Deploy

### Docker

```bash
docker build -t settlegrid-denmark-dst .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-denmark-dst
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
