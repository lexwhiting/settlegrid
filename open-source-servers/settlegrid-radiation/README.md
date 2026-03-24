# settlegrid-radiation

Environmental Radiation MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-radiation)

Access environmental radiation monitoring data via EPA RadNet. Get readings, list monitors, and view history.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_readings(state?)` | Get radiation readings by state | 1¢ |
| `list_monitors(state?)` | List radiation monitors | 1¢ |
| `get_history(monitor, days?)` | Get historical readings for a monitor | 2¢ |

## Parameters

### get_readings
- `state` (string) — Two-letter state code (e.g. NV, PA)

### list_monitors
- `state` (string) — Two-letter state code

### get_history
- `monitor` (string, required) — Monitor ID or location name
- `days` (number) — Number of days of history (default 7)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream EPA RadNet API — it is completely free.

## Upstream API

- **Provider**: EPA RadNet
- **Base URL**: https://www.epa.gov/enviro/radnet-csv-file-download
- **Auth**: None required
- **Docs**: https://www.epa.gov/radnet

## Deploy

### Docker

```bash
docker build -t settlegrid-radiation .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-radiation
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
