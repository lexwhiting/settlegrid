# settlegrid-comet-ml

Comet ML MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-comet-ml)

Access Comet ML experiment tracking data including workspaces, projects, and experiment metrics via the Comet REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_user_workspaces()` | Get all workspaces for the authenticated user | 1¢ |

## Parameters

### get_user_workspaces

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COMET_ML_API_KEY` | Yes | Comet ML API key from [https://www.comet.com/account-settings/apiKeys](https://www.comet.com/account-settings/apiKeys) |

## Upstream API

- **Provider**: Comet ML
- **Base URL**: https://www.comet.com
- **Auth**: API key required
- **Docs**: https://www.comet.com/docs/v2/api-and-sdk/overview/

## Deploy

### Docker

```bash
docker build -t settlegrid-comet-ml .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-comet-ml
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
