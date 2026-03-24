# settlegrid-fbi-crime

FBI Crime Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fbi-crime)

FBI Uniform Crime Reporting (UCR) crime statistics and data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FBI_CRIME_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_state_offenses(stateAbbr, since, until)` | Get offense counts by state | 2¢ |

## Parameters

### get_state_offenses
- `stateAbbr` (string, required) — State abbreviation (e.g. CA, TX)
- `since` (number, required) — Start year
- `until` (number, required) — End year

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FBI_CRIME_API_KEY` | No | FBI Crime Data API key from [https://api.data.gov/signup/](https://api.data.gov/signup/) |

## Upstream API

- **Provider**: FBI Crime Data
- **Base URL**: https://api.usa.gov/crime/fbi/sapi
- **Auth**: API key (query)
- **Docs**: https://crime-data-explorer.fr.cloud.gov/pages/docApi

## Deploy

### Docker

```bash
docker build -t settlegrid-fbi-crime .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FBI_CRIME_API_KEY=xxx -p 3000:3000 settlegrid-fbi-crime
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
