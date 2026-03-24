# settlegrid-cfr

Code of Federal Regulations MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cfr)

Browse and search the Code of Federal Regulations via the eCFR API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_sections(query, title?)` | Search CFR sections | 1¢ |
| `get_section(title, part, section)` | Get a specific CFR section | 1¢ |
| `list_titles()` | List all CFR titles | 1¢ |

## Parameters

### search_sections
- `query` (string, required) — Search query
- `title` (number) — CFR title number (1-50)

### get_section
- `title` (number, required) — CFR title number
- `part` (string, required) — CFR part number
- `section` (string, required) — CFR section number

### list_titles

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream eCFR API — it is completely free.

## Upstream API

- **Provider**: eCFR
- **Base URL**: https://www.ecfr.gov/api/versioner/v1
- **Auth**: None required
- **Docs**: https://www.ecfr.gov/developer/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-cfr .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cfr
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
