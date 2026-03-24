# settlegrid-carbon-intensity

UK Carbon Intensity MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-carbon-intensity)

UK electricity grid carbon intensity data from National Grid ESO.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current_intensity()` | Get current UK carbon intensity | 1¢ |
| `get_intensity_by_date(date)` | Get carbon intensity for date | 1¢ |
| `get_regional_intensity(region_id?)` | Get regional carbon intensity | 1¢ |

## Parameters

### get_current_intensity

### get_intensity_by_date
- `date` (string, required) — Date in YYYY-MM-DD format

### get_regional_intensity
- `region_id` (number) — Region ID (1-17)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Carbon Intensity UK API — it is completely free.

## Upstream API

- **Provider**: Carbon Intensity UK
- **Base URL**: https://api.carbonintensity.org.uk
- **Auth**: None required
- **Docs**: https://carbon-intensity.github.io/api-definitions/

## Deploy

### Docker

```bash
docker build -t settlegrid-carbon-intensity .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-carbon-intensity
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
