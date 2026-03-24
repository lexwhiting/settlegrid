# settlegrid-home-assistant

Home Assistant MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-home-assistant)

Control and monitor your Home Assistant smart home.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_states()` | Get all entity states | 1¢ |
| `get_entity_state(entity_id)` | Get entity state | 1¢ |
| `call_service(domain, service, entity_id)` | Call a service | 2¢ |

## Parameters

### get_entity_state
- `entity_id` (string, required) — Entity ID (e.g. light.living_room)
### call_service
- `domain` (string, required) — Service domain (light, switch, etc.)
- `service` (string, required) — Service name (turn_on, turn_off, toggle)
- `entity_id` (string, required) — Target entity ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HA_URL` | Yes | Home Assistant URL |
| `HA_TOKEN` | Yes | Long-lived access token |

## Upstream API

- **Provider**: Home Assistant REST API
- **Auth**: Long-lived access token
- **Docs**: https://developers.home-assistant.io/docs/api/rest/

## Deploy

### Docker
```bash
docker build -t settlegrid-home-assistant .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-home-assistant
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
