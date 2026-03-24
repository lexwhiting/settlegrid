# settlegrid-ham-radio

Ham Radio Callsign Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ham-radio)

Look up amateur radio callsigns, licensee data, and DXCC entities via Callook. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_callsign(callsign)` | Look up a callsign | 1¢ |
| `search_callsigns(query)` | Search callsigns by query | 1¢ |
| `get_dxcc(entity)` | Get DXCC entity info | 1¢ |

## Parameters

### lookup_callsign
- `callsign` (string, required) — Amateur radio callsign (e.g., W1AW)

### search_callsigns
- `query` (string, required) — Name or partial callsign to search for

### get_dxcc
- `entity` (string, required) — DXCC entity number or prefix

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Callook API — it is completely free.

## Upstream API

- **Provider**: Callook
- **Base URL**: https://callook.info
- **Auth**: None required
- **Docs**: https://callook.info/api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-ham-radio .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ham-radio
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
