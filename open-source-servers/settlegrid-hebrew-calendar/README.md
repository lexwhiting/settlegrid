# settlegrid-hebrew-calendar

heurew calendar utility MCP Server with SettleGrid billing

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hebrew-calendar)

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `convert(...)` | Convert Date | 1¢ |
| `get_holidays(...)` | Get Holidays | 1¢ |

## Parameters

### convert
- `gregorian_date` (string, required)

### get_holidays
- `month` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
