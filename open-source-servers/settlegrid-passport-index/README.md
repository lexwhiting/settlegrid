# settlegrid-passport-index

Passport Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-passport-index)

Passport power rankings and visa-free destination counts.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_passport_rank(country_code)` | Get passport ranking | 1¢ |
| `compare_passports(code_a, code_b)` | Compare two passports | 1¢ |
| `get_top_passports(limit)` | Get top-ranked passports | 1¢ |

## Parameters

### get_passport_rank
- `country_code` (string, required) — ISO alpha-2 or alpha-3 code
### compare_passports
- `code_a` (string, required) — First passport country code
- `code_b` (string, required) — Second passport country code
### get_top_passports
- `limit` (number, optional) — Number of results (default 10, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Passport Index
- **Base URL**: https://api.passportindex.org
- **Auth**: None required
- **Docs**: https://www.passportindex.org/

## Deploy

### Docker
```bash
docker build -t settlegrid-passport-index .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-passport-index
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
