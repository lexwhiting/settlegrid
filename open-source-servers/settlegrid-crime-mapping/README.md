# settlegrid-crime-mapping

FBI Crime Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-crime-mapping)

Crime statistics from the FBI Crime Data Explorer API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_state_crime(state)` | Get crime summary for a state abbreviation | 1¢ |
| `get_national_crime()` | Get national crime estimates | 1¢ |

## Parameters

### get_state_crime
- `state` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: FBI CJIS
- **Base URL**: https://api.usa.gov/crime/fbi/sapi
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://crime-data-explorer.fr.cloud.gov/pages/docApi

## Deploy

### Docker

```bash
docker build -t settlegrid-crime-mapping .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-crime-mapping
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
