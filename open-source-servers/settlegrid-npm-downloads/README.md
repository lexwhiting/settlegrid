# settlegrid-npm-downloads

npm Downloads MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-npm-downloads)

npm package download counts and statistics

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_downloads(package)` | Get download counts for a package | 1¢ |
| `get_range(package, start, end)` | Get daily download counts over a date range | 2¢ |

## Parameters

### get_downloads
- `package` (string, required) — npm package name

### get_range
- `package` (string, required) — npm package name
- `start` (string, required) — Start date YYYY-MM-DD
- `end` (string, required) — End date YYYY-MM-DD

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream npm Downloads API.

## Upstream API

- **Provider**: npm Downloads
- **Base URL**: https://api.npmjs.org
- **Auth**: None required
- **Docs**: https://github.com/npm/registry/blob/master/docs/download-counts.md

## Deploy

### Docker

```bash
docker build -t settlegrid-npm-downloads .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-npm-downloads
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
