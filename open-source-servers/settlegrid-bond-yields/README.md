# settlegrid-bond-yields

Government Bond Yields MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bond-yields)

US Treasury bond yields and yield curve data via Treasury FiscalData API. Free, no key required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_yields(date?)` | Get current Treasury yields | 1¢ |
| `get_curve(date?)` | Get yield curve | 1¢ |
| `get_historical(security, months?)` | Get historical yield data | 1¢ |

## Parameters

### get_yields
- `date` (string) — Specific date YYYY-MM-DD (default: latest)

### get_curve
- `date` (string) — Date for curve YYYY-MM-DD (default: latest)

### get_historical
- `security` (string, required) — Security type: 1mo, 3mo, 6mo, 1yr, 2yr, 5yr, 10yr, 30yr
- `months` (number) — Months of history (default: 12)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Treasury FiscalData API — it is completely free.

## Upstream API

- **Provider**: US Treasury FiscalData
- **Base URL**: https://api.fiscaldata.treasury.gov/services/api/fiscal_service
- **Auth**: None required
- **Docs**: https://fiscaldata.treasury.gov/api-documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-bond-yields .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bond-yields
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
