# settlegrid-fax-api

fax api MCP Server with SettleGrid billing

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fax-api)

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `format_fax_cover(...)` | Format Fax Cover | 2¢ |
| `get_country_codes(...)` | Get Country Codes | 2¢ |

## Parameters

### format_fax_cover
- `to_name` (string; to_fax: string; from_name: string; from_fax: string; subject: string; pages: number; message?: string, required)

### get_country_codes
- `country` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
