# settlegrid-chemspider

ChemSpider MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-chemspider)

Chemical compound search and molecular data from ChemSpider

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CHEMSPIDER_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(name)` | Search for chemical compounds | 2¢ |
| `get_details(recordId)` | Get compound details by record ID | 1¢ |

## Parameters

### search
- `name` (string, required) — Chemical compound name

### get_details
- `recordId` (number, required) — ChemSpider record ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CHEMSPIDER_API_KEY` | Yes | ChemSpider API key from [https://developer.rsc.org/](https://developer.rsc.org/) |

## Upstream API

- **Provider**: ChemSpider
- **Base URL**: https://api.rsc.org
- **Auth**: API key (header)
- **Docs**: https://developer.rsc.org/compounds-v1/apis

## Deploy

### Docker

```bash
docker build -t settlegrid-chemspider .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CHEMSPIDER_API_KEY=xxx -p 3000:3000 settlegrid-chemspider
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
