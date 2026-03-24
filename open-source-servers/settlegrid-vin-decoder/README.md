# settlegrid-vin-decoder

VIN Decoder MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-vin-decoder)

Decode Vehicle Identification Numbers via the NHTSA VPIC API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `decode_vin(vin)` | Decode a 17-char VIN to get vehicle specs | 1¢ |
| `decode_vin_batch(vins)` | Decode multiple VINs (semicolon-separated) | 1¢ |

## Parameters

### decode_vin
- `vin` (string, required)

### decode_vin_batch
- `vins` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: NHTSA VPIC
- **Base URL**: https://vpic.nhtsa.dot.gov/api/vehicles
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://vpic.nhtsa.dot.gov/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-vin-decoder .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-vin-decoder
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
