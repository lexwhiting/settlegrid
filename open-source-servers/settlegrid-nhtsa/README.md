# settlegrid-nhtsa

NHTSA MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nhtsa)

Vehicle safety recalls, complaints, and investigations from NHTSA.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_makes()` | Get all vehicle makes | 1¢ |
| `get_models(make, year)` | Get models for a make and year | 1¢ |
| `decode_vin(vin)` | Decode a Vehicle Identification Number | 1¢ |

## Parameters

### get_models
- `make` (string, required)
- `year` (number, required)

### decode_vin
- `vin` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: NHTSA
- **Base URL**: https://vpic.nhtsa.dot.gov/api
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://vpic.nhtsa.dot.gov/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-nhtsa .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nhtsa
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
