# settlegrid-robots-txt

Robots.txt Parser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-robots-txt)

Parse and analyze robots.txt files for any domain.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_robots(domain)` | Parse robots.txt | 1¢ |
| `check_url(domain, path)` | Check if URL is crawlable | 1¢ |

## Parameters

### get_robots
- `domain` (string, required) — Domain name
### check_url
- `domain` (string, required) — Domain name
- `path` (string, required) — URL path to check
- `user_agent` (string, optional) — Bot user agent (default *)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Direct fetch
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-robots-txt .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-robots-txt
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
