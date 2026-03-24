# settlegrid-wayback-machine

Wayback Machine MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wayback-machine)

Check if URLs are archived in the Internet Archive Wayback Machine.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_url(url)` | Check if a URL has been archived and get the latest snapshot | 1¢ |
| `get_snapshot(url, timestamp)` | Get a specific archived snapshot by URL and timestamp | 1¢ |

## Parameters

### check_url
- `url` (string, required)

### get_snapshot
- `url` (string, required)
- `timestamp` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Internet Archive
- **Base URL**: https://archive.org
- **Auth**: None required
- **Rate Limits**: No published limit (be respectful)
- **Docs**: https://archive.org/help/wayback_api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-wayback-machine .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-wayback-machine
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
