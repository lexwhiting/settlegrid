# settlegrid-port-traffic

Port Traffic MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-port-traffic)

Port traffic data, vessel tracking, and container throughput.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_port_info(port_code)` | Get port details | 1¢ |
| `search_ports(query)` | Search ports | 1¢ |
| `get_vessels_in_port(port_code)` | Get vessel data | 2¢ |

## Parameters

### get_port_info / get_vessels_in_port
- `port_code` (string, required) — UN/LOCODE (e.g. CNSHA, NLRTM)
### search_ports
- `query` (string, required) — Port name or country

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: World Bank / Built-in port database
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-port-traffic .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-port-traffic
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
