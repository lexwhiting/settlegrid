# settlegrid-npm-trends

npm Download Trends MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-npm-trends)

Query npm download statistics and compare package popularity. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_npm_downloads(package, period?)` | Download counts for a package | 1¢ |
| `compare_npm_packages(packages)` | Compare downloads across packages | 2¢ |

## Parameters

### get_npm_downloads
- `package` (string, required) — npm package name
- `period` (string) — Time period: last-day, last-week, last-month (default), last-year

### compare_npm_packages
- `packages` (string[], required) — Array of package names (2-10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No additional API keys needed.

## Upstream API

- **Provider**: npm Registry
- **Base URL**: https://api.npmjs.org/downloads
- **Auth**: None required
- **Docs**: https://github.com/npm/registry/blob/main/docs/download-counts.md

## Deploy

### Docker

```bash
docker build -t settlegrid-npm-trends .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-npm-trends
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
