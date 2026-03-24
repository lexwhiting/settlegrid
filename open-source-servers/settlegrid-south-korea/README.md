# settlegrid-south-korea

Korea Open Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-south-korea)

South Korean government statistics and open data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_statistics(keyword)` | Search Korean statistical tables | 1¢ |
| `get_table(table_id)` | Get data from a specific statistical table | 1¢ |

## Parameters

### search_statistics
- `keyword` (string, required)

### get_table
- `table_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: KOSIS (Korean Statistical Information Service)
- **Base URL**: https://kosis.kr
- **Auth**: None required
- **Rate Limits**: No published limit (no key for basic)
- **Docs**: https://kosis.kr/openapi/index/index.jsp

## Deploy

### Docker

```bash
docker build -t settlegrid-south-korea .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-south-korea
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
