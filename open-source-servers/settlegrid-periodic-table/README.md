# settlegrid-periodic-table

Periodic Table MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-periodic-table)

Look up chemical element data including properties, atomic info, and classifications.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_element(query)` | Get detailed info about a chemical element | 1¢ |
| `list_elements(category)` | List all elements or filter by group/category | 1¢ |

## Parameters

### get_element
- `query` (string, required) — Element name, symbol, or atomic number (e.g. "Hydrogen", "H", "1")

### list_elements
- `category` (string, optional) — Filter by category (e.g. "noble gas", "alkali metal", "transition metal")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Periodic Table API
- **Base URL**: https://neelpatel05.pythonanywhere.com
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://github.com/neelpatel05/periodic-table-api

## Deploy

### Docker

```bash
docker build -t settlegrid-periodic-table .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-periodic-table
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
