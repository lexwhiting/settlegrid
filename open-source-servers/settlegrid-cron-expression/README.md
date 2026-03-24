# settlegrid-cron-expression

Cron Expression Parser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cron-expression)

Parse, describe, and compute next runs for cron expressions. No external API needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse(expression)` | Validate and parse a cron expression | 1¢ |
| `next_runs(expression, count)` | Compute next N run times | 1¢ |
| `describe(expression)` | Human-readable description | 1¢ |

## Parameters

### parse
- `expression` (string, required) — Cron expression (e.g. "0 9 * * 1-5")

### next_runs
- `expression` (string, required) — Cron expression
- `count` (number, optional) — Number of runs to compute (default: 5, max: 20)

### describe
- `expression` (string, required) — Cron expression

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No external API key needed — all computation is performed locally.

## Deploy

### Docker

```bash
docker build -t settlegrid-cron-expression .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cron-expression
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
