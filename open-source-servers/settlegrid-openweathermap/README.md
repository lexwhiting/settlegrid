# settlegrid-openweathermap

OpenWeatherMap MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openweathermap)

Current weather, forecasts, and historical weather data for any location worldwide

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENWEATHERMAP_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_weather(city)` | Get current weather for a city | 1¢ |
| `get_forecast(city)` | Get 5-day/3-hour weather forecast | 2¢ |

## Parameters

### get_weather
- `city` (string, required) — City name
- `units` (string, optional) — Units: metric, imperial, standard (default: "metric")

### get_forecast
- `city` (string, required) — City name
- `units` (string, optional) — Units: metric, imperial, standard (default: "metric")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENWEATHERMAP_API_KEY` | Yes | OpenWeatherMap API key from [https://openweathermap.org/api](https://openweathermap.org/api) |

## Upstream API

- **Provider**: OpenWeatherMap
- **Base URL**: https://api.openweathermap.org/data/2.5
- **Auth**: API key (query)
- **Docs**: https://openweathermap.org/api

## Deploy

### Docker

```bash
docker build -t settlegrid-openweathermap .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENWEATHERMAP_API_KEY=xxx -p 3000:3000 settlegrid-openweathermap
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
