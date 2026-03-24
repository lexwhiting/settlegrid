# settlegrid-cron-scheduler

Cron Scheduler MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Parse cron expressions and calculate next execution times. All local, no API needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse_cron(expression)` | Parse and explain cron expression | Free |
| `next_runs(expression, count?)` | Get next N execution times | Free |
| `cron_presets()` | List common cron presets | Free |

## Parameters

### parse_cron / next_runs
- `expression` (string, required) — Cron expression (e.g., `*/5 * * * *`) or preset (`@daily`)
- `count` (number) — Number of future runs (1-25, default 5)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-cron-scheduler .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cron-scheduler
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
