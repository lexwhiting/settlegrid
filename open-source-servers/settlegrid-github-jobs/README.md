# settlegrid-github-jobs

Arbeitnow Developer Jobs MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-github-jobs)

Search developer and tech job listings via the Arbeitnow API (GitHub Jobs deprecated, uses Arbeitnow).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_dev_jobs(query, remote)` | Search developer and tech job listings | 1¢ |
| `get_latest_dev_jobs(page)` | Get most recently posted developer jobs | 1¢ |

## Parameters

### search_dev_jobs
- `query` (string, optional) — Job title or keyword filter
- `remote` (boolean, optional) — Filter remote-only jobs

### get_latest_dev_jobs
- `page` (number, optional) — Page number (default 1)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Arbeitnow
- **Base URL**: https://arbeitnow.com/api/job-board-api
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://arbeitnow.com/api/job-board-api

## Deploy

### Docker

```bash
docker build -t settlegrid-github-jobs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-github-jobs
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
