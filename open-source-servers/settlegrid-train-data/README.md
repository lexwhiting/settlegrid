# settlegrid-train-data

Finnish Rail MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-train-data)

Train schedules and live tracking from the Finnish Transport Agency.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_live_trains(station)` | Get live trains arriving/departing a station | 1¢ |
| `get_train(train_number, date)` | Get details of a specific train by number and date | 1¢ |
| `get_stations()` | Get all railway stations in Finland | 1¢ |

## Parameters

### get_live_trains
- `station` (string, required)

### get_train
- `train_number` (number, required)
- `date` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Digitraffic
- **Base URL**: https://rata.digitraffic.fi/api/v1
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://www.digitraffic.fi/en/railway/

## Deploy

### Docker

```bash
docker build -t settlegrid-train-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-train-data
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
