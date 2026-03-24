# settlegrid-usc

US Code MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usc)

Search and retrieve sections of the United States Code. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_sections(query, title?)` | Search US Code sections | 1¢ |
| `get_section(title, section)` | Get a specific USC section | 1¢ |
| `list_titles()` | List all USC titles | 1¢ |

## Parameters

### search_sections
- `query` (string, required) — Search query for statute text
- `title` (number) — USC title number

### get_section
- `title` (number, required) — USC title number
- `section` (string, required) — Section number

### list_titles

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream US Code / Congress.gov API — it is completely free.

## Upstream API

- **Provider**: US Code / Congress.gov
- **Base URL**: https://api.congress.gov/v3
- **Auth**: None required
- **Docs**: https://api.congress.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-usc .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usc
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
