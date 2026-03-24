# settlegrid-date-tools

Date/Time Tools MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-date-tools)

Convert timezones, calculate date differences, and compute business days. No external API needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `convert_timezone(date, from, to)` | Convert between timezones | 1¢ |
| `diff(date1, date2)` | Calculate difference between dates | 1¢ |
| `business_days(start, end)` | Count business days between dates | 1¢ |

## Parameters

### convert_timezone
- `date` (string, required) — ISO date string
- `from` (string, required) — Source timezone (e.g. "America/New_York")
- `to` (string, required) — Target timezone (e.g. "Europe/London")

### diff
- `date1` (string, required) — First date (ISO format)
- `date2` (string, required) — Second date (ISO format)

### business_days
- `start` (string, required) — Start date (ISO format)
- `end` (string, required) — End date (ISO format)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Deploy

### Docker

```bash
docker build -t settlegrid-date-tools .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-date-tools
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
