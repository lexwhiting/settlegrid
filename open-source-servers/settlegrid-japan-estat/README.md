# settlegrid-japan-estat

Japan e-Stat MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-japan-estat)

Japanese government statistics from the e-Stat portal.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ESTAT_APP_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_statistics(keyword, lang)` | Search Japanese statistical surveys and tables | 2¢ |
| `get_stats_data(stats_data_id)` | Get statistical data for a specific table ID | 2¢ |

## Parameters

### search_statistics
- `keyword` (string, required)
- `lang` (string, optional)

### get_stats_data
- `stats_data_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ESTAT_APP_ID` | Yes | Free key from e-stat.go.jp (registration required) |


## Upstream API

- **Provider**: Statistics Bureau of Japan
- **Base URL**: https://www.e-stat.go.jp
- **Auth**: Free API key required
- **Rate Limits**: No published limit
- **Docs**: https://www.e-stat.go.jp/api/api-info/e-stat-manual3-0

## Deploy

### Docker

```bash
docker build -t settlegrid-japan-estat .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ESTAT_APP_ID=xxx -p 3000:3000 settlegrid-japan-estat
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
