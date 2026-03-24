# settlegrid-horoscope

Horoscope MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-horoscope)

Daily horoscope readings for all zodiac signs.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_horoscope(sign, day)` | Get daily horoscope | 1¢ |
| `get_all_signs()` | Get all zodiac signs | 1¢ |

## Parameters

### get_horoscope
- `sign` (string, required) — Zodiac sign (aries, taurus, etc.)
- `day` (string, optional) — TODAY, TOMORROW, or YESTERDAY
### get_all_signs
No parameters.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Horoscope App API
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-horoscope .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-horoscope
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
