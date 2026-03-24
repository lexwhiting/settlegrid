# settlegrid-plant-id

Plant ID MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Identify plants from images and get plant information.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `identify(image_url)` | Identify plant from image URL | 3¢ |
| `get_health(image_url)` | Assess plant health | 3¢ |
| `search_plant(query)` | Search plant database | 1¢ |
| `get_plant(access_token)` | Get plant identification result | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `PLANTID_API_KEY` | Yes | Plant.id API key from [plant.id](https://plant.id/) |

## Upstream API

- **Provider**: Plant.id
- **Base URL**: https://plant.id/api/v3
- **Auth**: API key (header)
- **Docs**: https://plant.id/docs

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
