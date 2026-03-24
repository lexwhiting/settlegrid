# settlegrid-spectrum

Radio Spectrum Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-spectrum)

FCC radio spectrum license data, allocations, and wireless frequency information.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_licenses(query?, state?)` | Search FCC spectrum licenses | 1¢ |
| `get_license(id)` | Get detailed license info by ID | 1¢ |
| `get_allocation(band?)` | Get frequency band allocation info | 1¢ |

## Parameters

### search_licenses
- `query` (string) — Search term (licensee name, frequency, etc.)
- `state` (string) — US state code (e.g. CA, NY, TX)

### get_license
- `id` (string, required) — FCC license ID

### get_allocation
- `band` (string) — Frequency band (e.g. 700MHz, 2.4GHz, 5GHz)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream FCC Open Data API — it is completely free.

## Upstream API

- **Provider**: FCC Open Data
- **Base URL**: https://opendata.fcc.gov/api
- **Auth**: None required
- **Docs**: https://opendata.fcc.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-spectrum .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-spectrum
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
