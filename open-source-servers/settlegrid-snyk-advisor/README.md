# settlegrid-snyk-advisor

Snyk Advisor MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-snyk-advisor)

Query package health scores and known vulnerabilities. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_package_score(package, ecosystem?)` | Package health score | 1¢ |
| `get_package_vulnerabilities(package)` | Known vulnerabilities | 2¢ |

## Parameters

### get_package_score
- `package` (string, required) — Package name
- `ecosystem` (string) — Ecosystem: npm (default), pip, etc.

### get_package_vulnerabilities
- `package` (string, required) — Package name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |




## Deploy

### Docker

```bash
docker build -t settlegrid-snyk-advisor .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-snyk-advisor
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
