# settlegrid-ghana-data

Ghana Statistical Service (GSS) open data MCP Server with SettleGrid billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ghana-data)

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Cost |\n|--------|------|\n| `get_demographics(region)` | 2c |\n| `get_economy(indicator)` | 2c |

## Parameters

### get_demographics\n- `region` (string, optional)\n\n### get_economy\n- `indicator` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |



## Deploy

```bash
docker build -t settlegrid-ghana-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ghana-data
```

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
