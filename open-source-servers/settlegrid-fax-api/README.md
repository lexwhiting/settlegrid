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
| `generate_cover_page(...)` | Generate Cover Page | 1¢ |
| `format_document(...)` | Format Document | 1¢ |
| `get_country_codes(...)` | Get Country Codes | 1¢ |

## Parameters

### generate_cover_page
- `to` (string, required)
- `from` (string, required)
- `subject` (string, required)
- `company` (string, optional)
- `pages` (number, optional)
- `message` (string, optional)
- `urgent` (boolean, optional)

### format_document
- `text` (string, required)
- `header` (string, optional)
- `footer` (string, optional)
- `page_numbers` (boolean, optional)

### get_country_codes
- _No parameters._

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
