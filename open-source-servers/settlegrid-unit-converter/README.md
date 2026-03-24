# settlegrid-unit-converter

Unit Conversion MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-unit-converter)

Convert between units of measurement. Supports length, weight, temperature, volume, speed, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `convert(value, from, to)` | Convert between units | 1¢ |
| `list_units(category)` | List available units for a category | 1¢ |

## Parameters

### convert
- `value` (number, required) — Value to convert
- `from` (string, required) — Source unit (e.g. "km", "lb", "celsius")
- `to` (string, required) — Target unit (e.g. "mi", "kg", "fahrenheit")

### list_units
- `category` (string, optional) — Filter by category (length, weight, temperature, volume, speed, area, data)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Deploy

### Docker

```bash
docker build -t settlegrid-unit-converter .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-unit-converter
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
