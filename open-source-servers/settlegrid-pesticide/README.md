# settlegrid-pesticide

Pesticide Usage Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pesticide)

Access pesticide usage data, trends, and registration info from EPA and USDA sources. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_usage(pesticide?, crop?, state?)` | Get pesticide usage data | 2¢ |
| `list_pesticides()` | List common pesticides | 1¢ |
| `get_trends(pesticide)` | Get pesticide usage trends | 2¢ |

## Parameters

### get_usage
- `pesticide` (string) — Pesticide name or active ingredient
- `crop` (string) — Crop the pesticide is used on
- `state` (string) — US state abbreviation

### list_pesticides

### get_trends
- `pesticide` (string, required) — Pesticide name or active ingredient

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream EPA Pesticide Data API — it is completely free.

## Upstream API

- **Provider**: EPA Pesticide Data
- **Base URL**: https://iaspub.epa.gov/apex/pesticides/f
- **Auth**: None required
- **Docs**: https://www.epa.gov/pesticide-science-and-assessing-pesticide-risks

## Deploy

### Docker

```bash
docker build -t settlegrid-pesticide .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pesticide
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
