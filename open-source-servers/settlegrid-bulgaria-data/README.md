# settlegrid-bulgaria-data

Bulgaria National Statistical Institute data MCP Server with SettleGrid billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bulgaria-data)

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Cost |
|--------|------|
| `get_population(year)` | 2c |
| `get_indicators(type)` | 2c |

## Parameters

### get_population\n- `year` (number, optional)\n\n### get_indicators\n- `type` (string, required) — gdp, unemployment, inflation, trade

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |



## Deploy

```bash
docker build -t settlegrid-bulgaria-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bulgaria-data
```

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
