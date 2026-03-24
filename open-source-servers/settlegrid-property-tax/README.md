# settlegrid-property-tax

HUD Property Tax MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-property-tax)

Property tax and housing affordability data from HUD.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_state_data(stateid)` | Get housing cost data by state FIPS code | 1¢ |
| `get_area_data(cbsa)` | Get fair market rent by CBSA code | 1¢ |

## Parameters

### get_state_data
- `stateid` (string, required)

### get_area_data
- `cbsa` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: HUD User
- **Base URL**: https://www.huduser.gov/hudapi/public
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://www.huduser.gov/portal/dataset/fmr-api.html

## Deploy

### Docker

```bash
docker build -t settlegrid-property-tax .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-property-tax
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
