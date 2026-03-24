# settlegrid-world-bank-education

World Bank Education Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-world-bank-education)

Access World Bank education indicators including enrollment, literacy, and attainment data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_enrollment(country, level?, year?)` | Get school enrollment data | 2¢ |
| `get_literacy(country, year?)` | Get literacy rate data | 2¢ |
| `list_indicators()` | List education indicators | 1¢ |

## Parameters

### get_enrollment
- `country` (string, required) — ISO country code (e.g. USA, GBR)
- `level` (string) — Level: primary, secondary, tertiary (default: primary)
- `year` (string) — Year (e.g. 2021)

### get_literacy
- `country` (string, required) — ISO country code
- `year` (string) — Year

### list_indicators

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API API — it is completely free.

## Upstream API

- **Provider**: World Bank API
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392

## Deploy

### Docker

```bash
docker build -t settlegrid-world-bank-education .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-world-bank-education
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
