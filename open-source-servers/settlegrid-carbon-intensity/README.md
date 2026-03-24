# settlegrid-carbon-intensity

Carbon Intensity MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get real-time carbon intensity data for electricity grids.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current()` | Get current UK carbon intensity | 1¢ |
| `get_forecast()` | Get carbon intensity forecast | 1¢ |
| `get_by_date(date)` | Get intensity for specific date | 1¢ |
| `get_by_region(region)` | Get intensity by region | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Carbon Intensity UK
- **Base URL**: https://api.carbonintensity.org.uk
- **Auth**: None (public)
- **Docs**: https://carbon-intensity.github.io/api-definitions/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
