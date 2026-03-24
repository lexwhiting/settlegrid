# settlegrid-realtor

ATTOM Property Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-realtor)

Property data, valuations, and sales via the ATTOM API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ATTOM_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_properties(address1, address2)` | Search properties by address | 2¢ |
| `get_avm(address1, address2)` | Get automated valuation model for a property | 2¢ |

## Parameters

### search_properties
- `address1` (string, required)
- `address2` (string, required)

### get_avm
- `address1` (string, required)
- `address2` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ATTOM_API_KEY` | Yes | API key from attomdata.com |


## Upstream API

- **Provider**: ATTOM Data
- **Base URL**: https://api.gateway.attomdata.com
- **Auth**: Free API key required
- **Rate Limits**: Plan-based
- **Docs**: https://api.gateway.attomdata.com/propertyapi/v1.0.0/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-realtor .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ATTOM_API_KEY=xxx -p 3000:3000 settlegrid-realtor
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
